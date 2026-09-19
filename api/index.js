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

// Health check
app.get("/", (req, res) => {
    res.json({
        service: "N7-Link API",
        status: "online"
    });
});

// Create Minecraft linking code
app.post("/api/link/create", async (req, res) => {

    try {

        if (
            req.headers.authorization !==
            `Bearer ${API_SECRET}`
        ) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }

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

        // Remove any previous code for this Minecraft account
        await pool.query(
            `
            DELETE FROM link_codes
            WHERE minecraft_uuid = $1
            `,
            [minecraftUuid]
        );

        // Store new code
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
                NOW() + INTERVAL '5 minutes'
            )
            `,
            [
                code,
                minecraftUuid,
                minecraftUsername
            ]
        );

        res.json({
            success: true,
            message: "Link code created"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});

// Verify Discord linking code
app.post("/api/link/verify", async (req, res) => {

    try {

        if (
            req.headers.authorization !==
            `Bearer ${API_SECRET}`
        ) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }

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

        const result = await pool.query(
            `
            SELECT *
            FROM link_codes
            WHERE code = $1
              AND used = FALSE
              AND expires_at > NOW()
            LIMIT 1
            `,
            [code]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                error: "Invalid or expired code"
            });
        }

        const linkCode = result.rows[0];

        // Check Discord account
        const existingDiscord = await pool.query(
            `
            SELECT *
            FROM links
            WHERE discord_id = $1
            LIMIT 1
            `,
            [discordId]
        );

        if (existingDiscord.rows.length > 0) {

            return res.status(409).json({
                success: false,
                error: "Discord account is already linked"
            });
        }

        // Check Minecraft account
        const existingMinecraft = await pool.query(
            `
            SELECT *
            FROM links
            WHERE minecraft_uuid = $1
            LIMIT 1
            `,
            [linkCode.minecraft_uuid]
        );

        if (existingMinecraft.rows.length > 0) {

            return res.status(409).json({
                success: false,
                error: "Minecraft account is already linked"
            });
        }

        // Create link
        await pool.query(
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

        // Mark code as used
        await pool.query(
            `
            UPDATE link_codes
            SET used = TRUE
            WHERE id = $1
            `,
            [linkCode.id]
        );

        res.json({
            success: true,
            minecraftUsername:
                linkCode.minecraft_username,

            minecraftUuid:
                linkCode.minecraft_uuid
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});

// Get linked account
app.get("/api/link/:discordId", async (req, res) => {

    try {

        if (
            req.headers.authorization !==
            `Bearer ${API_SECRET}`
        ) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }

        const result = await pool.query(
            `
            SELECT *
            FROM links
            WHERE discord_id = $1
            LIMIT 1
            `,
            [req.params.discordId]
        );

        if (result.rows.length === 0) {

            return res.json({
                success: true,
                linked: false
            });
        }

        const link = result.rows[0];

        res.json({
            success: true,
            linked: true,
            minecraftUsername:
                link.minecraft_username,

            minecraftUuid:
                link.minecraft_uuid,

            linkedAt:
                link.linked_at
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `N7-Link API running on port ${PORT}`
    );
});
