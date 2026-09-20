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


// =====================================================
// AUTHENTICATION
// =====================================================

function isAuthorized(req) {
    return (
        API_SECRET &&
        req.headers.authorization ===
        `Bearer ${API_SECRET}`
    );
}


// =====================================================
// HEALTH CHECK
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
            String(code).trim().toUpperCase();

        if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
            return res.status(400).json({
                success: false,
                error: "Invalid linking code"
            });
        }

        // Remove previous unused codes
        // for this Minecraft account.
        await pool.query(
            `
            DELETE FROM link_codes
            WHERE minecraft_uuid = $1
            AND used = FALSE
            `,
            [minecraftUuid]
        );

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
            expiresInMinutes: CODE_EXPIRY_MINUTES
        });

    } catch (error) {

        console.error(
            "Create link code error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});


// =====================================================
// VERIFY LINK CODE
// =====================================================

app.post("/api/link/verify", async (req, res) => {

    if (!isAuthorized(req)) {
        return res.status(401).json({
            success: false,
            error: "Unauthorized"
        });
    }

    const client = await pool.connect();

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
            String(code).trim().toUpperCase();

        if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
            return res.status(400).json({
                success: false,
                error: "Invalid linking code"
            });
        }

        await client.query("BEGIN");

        // Lock this code while it is being verified.
        const codeResult = await client.query(
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

        const linkCode = codeResult.rows[0];

        // Check Discord account.
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

        // Check Minecraft account.
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

        // Create the permanent link.
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
            `,
            [
                discordId,
                linkCode.minecraft_uuid,
                linkCode.minecraft_username
            ]
        );

        // Mark code as used.
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

            linkedAt: new Date().toISOString()
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
// GET LINKED ACCOUNT
// =====================================================

app.get("/api/link/:discordId", async (req, res) => {

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

        const result = await pool.query(
            `
            SELECT
                discord_id,
                minecraft_uuid,
                minecraft_username,
                linked_at
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

        const link = result.rows[0];

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
                link.linked_at
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
});


// =====================================================
// UNLINK ACCOUNT
// =====================================================

app.delete("/api/link/:discordId", async (req, res) => {

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

        const result = await pool.query(
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
});


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
