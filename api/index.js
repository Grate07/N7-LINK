const express = require("express");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const API_SECRET = process.env.N7LINK_API_SECRET;

if (!DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not configured.");
    process.exit(1);
}

if (!API_SECRET) {
    console.error("ERROR: N7LINK_API_SECRET is not configured.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


/*
 * ---------------------------------------------------------
 * Authentication
 * ---------------------------------------------------------
 */

function authenticate(req, res, next) {

    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).json({
            error: "Missing authorization"
        });
    }

    if (!authorization.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Invalid authorization format"
        });
    }

    const token = authorization.substring(7);

    if (token !== API_SECRET) {
        return res.status(403).json({
            error: "Invalid API secret"
        });
    }

    next();
}


/*
 * ---------------------------------------------------------
 * Health Check
 * ---------------------------------------------------------
 */

app.get("/", (req, res) => {

    res.json({
        service: "N7-Link API",
        status: "online"
    });

});


/*
 * ---------------------------------------------------------
 * Create Minecraft Link Code
 * ---------------------------------------------------------
 *
 * POST /api/link/create
 *
 * ---------------------------------------------------------
 */

app.post("/api/link/create", authenticate, async (req, res) => {

    try {

        const {
            minecraftUuid,
            minecraftUsername,
            code
        } = req.body;

        if (
            !minecraftUuid ||
            !minecraftUsername ||
            !code
        ) {
            return res.status(400).json({
                error:
                    "minecraftUuid, minecraftUsername and code are required"
            });
        }


        /*
         * Check whether Minecraft account already exists.
         */

        const existing = await pool.query(
            `
            SELECT *
            FROM links
            WHERE minecraft_uuid = $1
            LIMIT 1
            `,
            [minecraftUuid]
        );


        if (existing.rows.length > 0) {

            const account = existing.rows[0];


            /*
             * Already linked accounts cannot create
             * another link code.
             */

            if (account.linked) {

                return res.status(409).json({
                    error:
                        "Minecraft account is already linked",

                    linked: true
                });

            }


            /*
             * Check whether the new code is already
             * being used by another account.
             */

            const codeCheck = await pool.query(
                `
                SELECT id
                FROM links
                WHERE link_code = $1
                  AND minecraft_uuid != $2
                LIMIT 1
                `,
                [
                    code,
                    minecraftUuid
                ]
            );


            if (codeCheck.rows.length > 0) {

                return res.status(409).json({
                    error:
                        "Link code already exists"
                });

            }


            /*
             * Update existing pending link.
             */

            const expiresAt =
                new Date(
                    Date.now() +
                    5 * 60 * 1000
                );


            const updated = await pool.query(
                `
                UPDATE links

                SET
                    minecraft_username = $1,
                    link_code = $2,
                    code_expires_at = $3

                WHERE minecraft_uuid = $4

                RETURNING *
                `,
                [
                    minecraftUsername,
                    code,
                    expiresAt,
                    minecraftUuid
                ]
            );


            return res.json({

                success: true,

                message:
                    "Link code created",

                expiresAt:
                    updated.rows[0].code_expires_at

            });

        }


        /*
         * Make sure the code isn't already being used.
         */

        const codeCheck = await pool.query(
            `
            SELECT id
            FROM links
            WHERE link_code = $1
            LIMIT 1
            `,
            [code]
        );


        if (codeCheck.rows.length > 0) {

            return res.status(409).json({
                error:
                    "Link code already exists"
            });

        }


        const expiresAt =
            new Date(
                Date.now() +
                5 * 60 * 1000
            );


        const result = await pool.query(
            `
            INSERT INTO links (
                minecraft_uuid,
                minecraft_username,
                link_code,
                code_expires_at,
                linked
            )

            VALUES (
                $1,
                $2,
                $3,
                $4,
                FALSE
            )

            RETURNING *
            `,
            [
                minecraftUuid,
                minecraftUsername,
                code,
                expiresAt
            ]
        );


        res.json({

            success: true,

            message:
                "Link code created",

            expiresAt:
                result.rows[0].code_expires_at

        });

    } catch (error) {

        console.error(
            "Create link error:",
            error
        );

        res.status(500).json({
            error:
                "Internal server error"
        });

    }

});


/*
 * ---------------------------------------------------------
 * Verify Discord Link Code
 * ---------------------------------------------------------
 *
 * POST /api/link/verify
 *
 * ---------------------------------------------------------
 */

app.post("/api/link/verify", authenticate, async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            discordId,
            code
        } = req.body;


        if (!discordId || !code) {

            return res.status(400).json({
                error:
                    "discordId and code are required"
            });

        }


        await client.query("BEGIN");


        /*
         * Find valid, unexpired code.
         */

        const result = await client.query(
            `
            SELECT *
            FROM links
            WHERE link_code = $1
              AND linked = FALSE
              AND code_expires_at > NOW()
            FOR UPDATE
            `,
            [code]
        );


        if (result.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                error:
                    "Invalid or expired link code"
            });

        }


        const account = result.rows[0];


        /*
         * Check whether this Discord account is already
         * linked to another Minecraft account.
         */

        const discordCheck = await client.query(
            `
            SELECT *
            FROM links
            WHERE discord_id = $1
              AND linked = TRUE
            LIMIT 1
            `,
            [discordId]
        );


        if (discordCheck.rows.length > 0) {

            await client.query("ROLLBACK");

            return res.status(409).json({
                error:
                    "Discord account is already linked"
            });

        }


        /*
         * Complete the link.
         */

        const linked = await client.query(
            `
            UPDATE links

            SET
                discord_id = $1,
                linked = TRUE,
                linked_at = NOW(),
                link_code = NULL,
                code_expires_at = NULL

            WHERE id = $2

            RETURNING *
            `,
            [
                discordId,
                account.id
            ]
        );


        await client.query("COMMIT");


        const linkedAccount =
            linked.rows[0];


        /*
         * Check permanent reward history.
         *
         * IMPORTANT:
         * This is NOT the same as links.reward_claimed.
         *
         * A Discord account that claimed a reward in the
         * past must never receive it again.
         */

        const rewardHistory =
            await pool.query(
                `
                SELECT discord_id
                FROM discord_reward_claims
                WHERE discord_id = $1
                LIMIT 1
                `,
                [discordId]
            );


        const rewardAlreadyClaimed =
            rewardHistory.rows.length > 0;


        res.json({

            success: true,

            message:
                "Discord account linked",

            minecraft: {

                uuid:
                    linkedAccount.minecraft_uuid,

                username:
                    linkedAccount.minecraft_username

            },

            discordId:
                linkedAccount.discord_id,

            rewardClaimed:
                rewardAlreadyClaimed

        });


    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (_) {
            // Ignore rollback errors.
        }


        console.error(
            "Verify link error:",
            error
        );


        res.status(500).json({
            error:
                "Internal server error"
        });


    } finally {

        client.release();

    }

});


/*
 * ---------------------------------------------------------
 * Get Minecraft Link Information
 * ---------------------------------------------------------
 *
 * GET /api/link/minecraft/:uuid
 *
 * ---------------------------------------------------------
 */

app.get(
    "/api/link/minecraft/:uuid",
    authenticate,
    async (req, res) => {

        try {

            const uuid =
                req.params.uuid;


            const result = await pool.query(
                `
                SELECT
                    minecraft_uuid,
                    minecraft_username,
                    discord_id,
                    linked,
                    reward_claimed,
                    linked_at

                FROM links

                WHERE minecraft_uuid = $1

                LIMIT 1
                `,
                [uuid]
            );


            if (result.rows.length === 0) {

                return res.json({

                    exists: false,

                    linked: false,

                    rewardClaimed: false

                });

            }


            const account =
                result.rows[0];


            let rewardClaimed = false;


            /*
             * If linked, check the permanent Discord
             * reward history.
             */

            if (
                account.linked &&
                account.discord_id
            ) {

                const rewardHistory =
                    await pool.query(
                        `
                        SELECT discord_id
                        FROM discord_reward_claims
                        WHERE discord_id = $1
                        LIMIT 1
                        `,
                        [account.discord_id]
                    );


                rewardClaimed =
                    rewardHistory.rows.length > 0;
            }


            res.json({

                exists: true,

                linked:
                    account.linked,

                rewardClaimed:
                    rewardClaimed,

                minecraftUsername:
                    account.minecraft_username,

                discordId:
                    account.discord_id,

                linkedAt:
                    account.linked_at

            });


        } catch (error) {

            console.error(
                "Minecraft lookup error:",
                error
            );


            res.status(500).json({
                error:
                    "Internal server error"
            });

        }

    }
);
/*
 * ---------------------------------------------------------
 * Get Discord Link Information
 * ---------------------------------------------------------
 *
 * GET /api/link/discord/:discordId
 *
 * ---------------------------------------------------------
 */

app.get(
    "/api/link/discord/:discordId",
    authenticate,
    async (req, res) => {

        try {

            const discordId =
                req.params.discordId;


            const result = await pool.query(
                `
                SELECT
                    minecraft_uuid,
                    minecraft_username,
                    discord_id,
                    linked,
                    reward_claimed,
                    linked_at

                FROM links

                WHERE discord_id = $1
                  AND linked = TRUE

                LIMIT 1
                `,
                [discordId]
            );


            if (result.rows.length === 0) {

                return res.json({
                    linked: false
                });

            }


            const account =
                result.rows[0];


            /*
             * Check the permanent reward history.
             */

            const rewardHistory =
                await pool.query(
                    `
                    SELECT discord_id
                    FROM discord_reward_claims
                    WHERE discord_id = $1
                    LIMIT 1
                    `,
                    [discordId]
                );


            const rewardClaimed =
                rewardHistory.rows.length > 0;


            res.json({

                linked: true,

                minecraft: {

                    uuid:
                        account.minecraft_uuid,

                    username:
                        account.minecraft_username

                },

                discordId:
                    account.discord_id,

                rewardClaimed:
                    rewardClaimed,

                linkedAt:
                    account.linked_at

            });


        } catch (error) {

            console.error(
                "Discord lookup error:",
                error
            );


            res.status(500).json({
                error:
                    "Internal server error"
            });

        }

    }
);


/*
 * ---------------------------------------------------------
 * Claim Minecraft Reward
 * ---------------------------------------------------------
 *
 * POST /api/link/minecraft/:uuid/reward-claim
 *
 * IMPORTANT:
 * A Discord account can only claim the reward ONCE.
 * Unlinking does not reset this.
 *
 * ---------------------------------------------------------
 */

app.post(
    "/api/link/minecraft/:uuid/reward-claim",
    authenticate,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const uuid =
                req.params.uuid;


            await client.query("BEGIN");


            /*
             * Find the currently linked Minecraft account.
             */

            const linkResult =
                await client.query(
                    `
                    SELECT
                        minecraft_uuid,
                        discord_id,
                        linked

                    FROM links

                    WHERE minecraft_uuid = $1
                      AND linked = TRUE

                    LIMIT 1

                    FOR UPDATE
                    `,
                    [uuid]
                );


            if (linkResult.rows.length === 0) {

                await client.query("ROLLBACK");

                return res.status(404).json({

                    success: false,

                    error:
                        "Minecraft account is not linked"

                });

            }


            const account =
                linkResult.rows[0];


            const discordId =
                account.discord_id;


            if (!discordId) {

                await client.query("ROLLBACK");

                return res.status(404).json({

                    success: false,

                    error:
                        "Discord account not found"

                });

            }


            /*
             * IMPORTANT:
             *
             * Check the permanent reward table.
             *
             * This survives /unlink.
             */

            const existingClaim =
                await client.query(
                    `
                    SELECT discord_id

                    FROM discord_reward_claims

                    WHERE discord_id = $1

                    LIMIT 1

                    FOR UPDATE
                    `,
                    [discordId]
                );


            if (existingClaim.rows.length > 0) {

                await client.query("ROLLBACK");

                return res.status(409).json({

                    success: false,

                    error:
                        "Reward has already been claimed"

                });

            }


            /*
             * Permanently record the reward claim.
             *
             * The PRIMARY KEY on discord_id provides
             * an additional database-level protection
             * against duplicate claims.
             */

            await client.query(
                `
                INSERT INTO discord_reward_claims (
                    discord_id
                )

                VALUES ($1)
                `,
                [discordId]
            );


            /*
             * Update the current link as well.
             */

            await client.query(
                `
                UPDATE links

                SET reward_claimed = TRUE

                WHERE minecraft_uuid = $1
                `,
                [uuid]
            );


            await client.query("COMMIT");


            res.json({

                success: true,

                message:
                    "Reward claimed"

            });


        } catch (error) {

            try {
                await client.query("ROLLBACK");
            } catch (_) {
                // Ignore rollback errors.
            }


            /*
             * PostgreSQL duplicate-key protection.
             */

            if (error.code === "23505") {

                return res.status(409).json({

                    success: false,

                    error:
                        "Reward has already been claimed"

                });

            }


            console.error(
                "Reward claim error:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Internal server error"

            });


        } finally {

            client.release();

        }

    }
);


/*
 * ---------------------------------------------------------
 * Unlink Discord Account
 * ---------------------------------------------------------
 *
 * POST /api/link/unlink
 *
 * Body:
 * {
 *   discordId: "123456789"
 * }
 *
 * IMPORTANT:
 * This does NOT delete the permanent reward claim.
 *
 * ---------------------------------------------------------
 */

app.post(
    "/api/link/unlink",
    authenticate,
    async (req, res) => {

        try {

            const {
                discordId
            } = req.body;


            if (!discordId) {

                return res.status(400).json({

                    error:
                        "discordId is required"

                });

            }


            const result =
                await pool.query(
                    `
                    UPDATE links

                    SET
                        discord_id = NULL,
                        linked = FALSE,
                        link_code = NULL,
                        code_expires_at = NULL,
                        linked_at = NULL,
                        reward_claimed = FALSE

                    WHERE discord_id = $1
                      AND linked = TRUE

                    RETURNING minecraft_uuid
                    `,
                    [discordId]
                );


            if (result.rows.length === 0) {

                return res.status(404).json({

                    error:
                        "No linked account found"

                });

            }


            /*
             * DO NOT delete anything from:
             *
             * discord_reward_claims
             *
             * This is what prevents reward exploitation.
             */


            res.json({

                success: true,

                message:
                    "Account unlinked"

            });


        } catch (error) {

            console.error(
                "Unlink error:",
                error
            );


            res.status(500).json({

                error:
                    "Internal server error"

            });

        }

    }
);


/*
 * ---------------------------------------------------------
 * Start Server
 * ---------------------------------------------------------
 */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `N7-Link API running on port ${PORT}`
        );

    }
);
