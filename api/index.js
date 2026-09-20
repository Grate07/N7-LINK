const express = require("express");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const API_SECRET = process.env.N7LINK_API_SECRET;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const CODE_EXPIRY_MINUTES =
    Number(process.env.N7LINK_CODE_EXPIRY_MINUTES) || 5;

function isAuthorized(req) {
    return (
        API_SECRET &&
        req.headers.authorization ===
        `Bearer ${API_SECRET}`
    );
}

// =====================================================
// HEALTH
// =====================================================

app.get("/", (req, res) => {
    res.json({
        service: "N7-Link API",
        status: "online"
    });
});

// =====================================================
// CREATE LINK CODE
// =====================================================

app.post("/api/link/create", async (req, res) => {

    if (!isAuthorized(req)) {
        return res.status(401).json({
            success: false,
            error: "Unauthorized"
        });
    }

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
                success: false,
                error: "Missing required fields"
            });
        }

        const cleanCode =
            String(code)
                .trim()
                .toUpperCase();

        if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
            return res.status(400).json({
                success: false,
                error: "Invalid linking code"
            });
        }

        // Check if Minecraft account is already linked
        const existingLink =
            await pool.query(
                `
                SELECT id
                FROM links
                WHERE minecraft_uuid = $1
                LIMIT 1
                `,
                [minecraftUuid]
            );

        if (existingLink.rows.length > 0) {

            return res.status(409).json({
                success: false,
                error: "Minecraft account is already linked"
            });
        }

        // Remove previous unused codes
        await pool.query(
            `
            DELETE FROM link_codes
            WHERE minecraft_uuid = $1
            AND used = FALSE
            `,
            [minecraftUuid]
        );

        // Create new code
        await pool.query(
            `
            INSERT INTO link_codes
            (
                code,
                minecraft_uuid,
                minecraft_username,
                expires_at
            )
            VALUES
            (
                $1,
                $2,
                $3,
                NOW() + ($4 * INTERVAL '1 minute')
            )
            `,
            [
                cleanCode,
                minecraftUuid,
                minecraftUsername,
                CODE_EXPIRY_MINUTES
            ]
        );

        return res.json({
            success: true,
            message: "Link code created",
            expiresInMinutes:
                CODE_EXPIRY_MINUTES
        });

    } catch (error) {

        console.error(
            "Create link code error:",
            error
        );

        // Unique code collision
        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                error: "Link code collision"
            });
        }

        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});

// =====================================================
// VERIFY LINK
// =====================================================

app.post("/api/link/verify", async (req, res) => {

    if (!isAuthorized(req)) {
        return res.status(401).json({
            success: false,
            error: "Unauthorized"
        });
    }

    const client =
        await pool.connect();

    try {

        const {
            discordId,
            code
        } = req.body;

        if (!discordId || !code) {

            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }

        const cleanCode =
            String(code)
                .trim()
                .toUpperCase();

        if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {

            return res.status(400).json({
                success: false,
                error: "Invalid linking code"
            });
        }

        await client.query("BEGIN");

        const codeResult =
            await client.query(
                `
                SELECT *
                FROM link_codes
                WHERE code = $1
                  AND used = FALSE
                  AND expires_at > NOW()
                LIMIT 1
                FOR UPDATE
                `,
                [cleanCode]
            );

        if (codeResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                error: "Invalid or expired code"
            });
        }

        const linkCode =
            codeResult.rows[0];

        // Check Discord account
        const existingDiscord =
            await client.query(
                `
                SELECT *
                FROM links
                WHERE discord_id = $1
                LIMIT 1
                `,
                [discordId]
            );

        if (existingDiscord.rows.length > 0) {

            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                error: "Discord account is already linked"
            });
        }

        // Check Minecraft account
        const existingMinecraft =
            await client.query(
                `
                SELECT *
                FROM links
                WHERE minecraft_uuid = $1
                LIMIT 1
                `,
                [linkCode.minecraft_uuid]
            );

        if (existingMinecraft.rows.length > 0) {

            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,
                error: "Minecraft account is already linked"
            });
        }

        // Create link
        const inserted =
            await client.query(
                `
                INSERT INTO links
                (
                    discord_id,
                    minecraft_uuid,
                    minecraft_username
                )
                VALUES
                ($1, $2, $3)
                RETURNING
                    linked_at
                `,
                [
                    discordId,
                    linkCode.minecraft_uuid,
                    linkCode.minecraft_username
                ]
            );

        // Mark code as used
        await client.query(
            `
            UPDATE link_codes
            SET used = TRUE
            WHERE id = $1
            `,
            [linkCode.id]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            minecraftUsername:
                linkCode.minecraft_username,
            minecraftUuid:
                linkCode.minecraft_uuid,
            linkedAt:
                inserted.rows[0].linked_at,
            rewardClaimed: false
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch {}

        console.error(
            "Verify link error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });

    } finally {

        client.release();
    }
});

// =====================================================
// GET LINK BY DISCORD ID
// =====================================================

app.get(
    "/api/link/:discordId",
    async (req, res) => {

        if (!isAuthorized(req)) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }

        try {

            const {
                discordId
            } = req.params;

            const result =
                await pool.query(
                    `
                    SELECT
                        discord_id,
                        minecraft_uuid,
                        minecraft_username,
                        linked_at,
                        reward_claimed_at
                    FROM links
                    WHERE discord_id = $1
                    LIMIT 1
                    `,
                    [discordId]
                );

            if (result.rows.length === 0) {

                return res.json({
                    success: true,
                    linked: false
                });
            }

            const link =
                result.rows[0];

            return res.json({
                success: true,
                linked: true,
                discordId:
                    link.discord_id,
                minecraftUsername:
                    link.minecraft_username,
                minecraftUuid:
                    link.minecraft_uuid,
                linkedAt:
                    link.linked_at,
                rewardClaimed:
                    link.reward_claimed_at !== null
            });

        } catch (error) {

            console.error(
                "Get link error:",
                error
            );

            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
);

// =====================================================
// GET LINK BY MINECRAFT UUID
// =====================================================

app.get(
    "/api/link/minecraft/:minecraftUuid",
    async (req, res) => {

        if (!isAuthorized(req)) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }

        try {

            const {
                minecraftUuid
            } = req.params;

            const result =
                await pool.query(
                    `
                    SELECT
                        minecraft_uuid,
                        minecraft_username,
                        linked_at,
                        reward_claimed_at
                    FROM links
                    WHERE minecraft_uuid = $1
                    LIMIT 1
                    `,
                    [minecraftUuid]
                );

            if (result.rows.length === 0) {

                return res.json({
                    success: true,
                    linked: false
                });
            }

            const link =
                result.rows[0];

            return res.json({
                success: true,
                linked: true,
                minecraftUuid:
                    link.minecraft_uuid,
                minecraftUsername:
                    link.minecraft_username,
                linkedAt:
                    link.linked_at,
                rewardClaimed:
                    link.reward_claimed_at !== null
            });

        } catch (error) {

            console.error(
                "Get Minecraft link error:",
                error
            );

            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
);

// =====================================================
// CLAIM REWARD
// =====================================================

app.post(
    "/api/link/minecraft/:minecraftUuid/reward-claim",
    async (req, res) => {

        if (!isAuthorized(req)) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }

        const client =
            await pool.connect();

        try {

            const {
                minecraftUuid
            } = req.params;

            await client.query("BEGIN");

            const result =
                await client.query(
                    `
                    SELECT
                        id,
                        minecraft_uuid,
                        minecraft_username,
                        reward_claimed_at
                    FROM links
                    WHERE minecraft_uuid = $1
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [minecraftUuid]
                );

            if (result.rows.length === 0) {

                await client.query("ROLLBACK");

                return res.status(404).json({
                    success: false,
                    error: "Minecraft account is not linked"
                });
            }

            const link =
                result.rows[0];

            if (
                link.reward_claimed_at !== null
            ) {

                await client.query("ROLLBACK");

                return res.status(409).json({
                    success: false,
                    error: "Reward has already been claimed"
                });
            }

            const updated =
                await client.query(
                    `
                    UPDATE links
                    SET reward_claimed_at = NOW()
                    WHERE id = $1
                    RETURNING reward_claimed_at
                    `,
                    [link.id]
                );

            await client.query("COMMIT");

            return res.json({
                success: true,
                minecraftUuid:
                    link.minecraft_uuid,
                minecraftUsername:
                    link.minecraft_username,
                rewardClaimed: true,
                rewardClaimedAt:
                    updated.rows[0].reward_claimed_at
            });

        } catch (error) {

            try {
                await client.query("ROLLBACK");
            } catch {}

            console.error(
                "Reward claim error:",
                error
            );

            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });

        } finally {

            client.release();
        }
    }
);

// =====================================================
// UNLINK
// =====================================================

app.delete(
    "/api/link/:discordId",
    async (req, res) => {

        if (!isAuthorized(req)) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }

        try {

            const {
                discordId
            } = req.params;

            const result =
                await pool.query(
                    `
                    DELETE FROM links
                    WHERE discord_id = $1
                    RETURNING *
                    `,
                    [discordId]
                );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    error: "Account is not linked"
                });
            }

            return res.json({
                success: true,
                message: "Account unlinked"
            });

        } catch (error) {

            console.error(
                "Unlink error:",
                error
            );

            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `N7-Link API running on port ${PORT}`
        );

        console.log(
            `Code expiry: ${CODE_EXPIRY_MINUTES} minutes`
        );
    }
);
