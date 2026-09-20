const express = require("express");

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    Events,
    PermissionsBitField
} = require("discord.js");


// =====================================================
// HEALTH SERVER FOR RENDER
// =====================================================

const webApp = express();

const PORT = process.env.PORT || 3000;

webApp.get("/", (req, res) => {
    res.json({
        service: "N7-Link Discord Bot",
        status: "online"
    });
});

webApp.listen(PORT, "0.0.0.0", () => {
    console.log(
        `N7-Link health server running on port ${PORT}`
    );
});


// =====================================================
// CONFIGURATION
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const API_URL = process.env.N7LINK_API_URL;
const API_SECRET = process.env.N7LINK_API_SECRET;

const LINKED_ROLE_ID =
    process.env.N7LINK_LINKED_ROLE_ID;


// =====================================================
// CONFIGURATION CHECK
// =====================================================

if (!TOKEN) {
    console.error("Missing DISCORD_TOKEN");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("Missing DISCORD_CLIENT_ID");
    process.exit(1);
}

if (!GUILD_ID) {
    console.error("Missing DISCORD_GUILD_ID");
    process.exit(1);
}

if (!API_URL) {
    console.error("Missing N7LINK_API_URL");
    process.exit(1);
}

if (!API_SECRET) {
    console.error("Missing N7LINK_API_SECRET");
    process.exit(1);
}

if (!LINKED_ROLE_ID) {
    console.error(
        "Missing N7LINK_LINKED_ROLE_ID"
    );
    process.exit(1);
}


// =====================================================
// DISCORD CLIENT
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});


// =====================================================
// API REQUEST HELPER
// =====================================================

async function apiRequest(
    endpoint,
    options = {}
) {

    const response = await fetch(
        `${API_URL}${endpoint}`,
        {
            ...options,

            headers: {
                "Content-Type": "application/json",

                "Authorization":
                    `Bearer ${API_SECRET}`,

                ...(options.headers || {})
            }
        }
    );

    let data;

    try {

        data = await response.json();

    } catch {

        data = {
            success: false,
            error: "Invalid API response"
        };
    }

    return {
        status: response.status,
        data
    };
}


// =====================================================
// SLASH COMMANDS
// =====================================================

const commands = [

    new SlashCommandBuilder()
        .setName("link")
        .setDescription(
            "Open the Minecraft account linking panel"
        ),

    new SlashCommandBuilder()
        .setName("profile")
        .setDescription(
            "View your linked Minecraft account"
        ),

    new SlashCommandBuilder()
        .setName("linkinfo")
        .setDescription(
            "View your account linking information"
        ),

    new SlashCommandBuilder()
        .setName("unlink")
        .setDescription(
            "Unlink your Minecraft account"
        ),

    new SlashCommandBuilder()
        .setName("setup-link")
        .setDescription(
            "Create the N7-Link account linking panel"
        )

].map(command => command.toJSON());


// =====================================================
// REGISTER COMMANDS
// =====================================================

async function registerCommands() {

    const rest = new REST({
        version: "10"
    }).setToken(TOKEN);

    console.log(
        "Registering N7-Link commands..."
    );

    await rest.put(
        Routes.applicationGuildCommands(
            CLIENT_ID,
            GUILD_ID
        ),
        {
            body: commands
        }
    );

    console.log(
        "N7-Link commands registered."
    );
}


// =====================================================
// LINK EMBED
// =====================================================

function createLinkEmbed() {

    return new EmbedBuilder()

        .setColor(0x0B0B0D)

        .setTitle("🔗  Link Account")

        .setDescription(
            [
                "",
                "Connect your Minecraft account",
                "to your Discord account.",
                "",
                "Click the button below to begin.",
                ""
            ].join("\n")
        )

        .setFooter({
            text:
                "N7-Link • Secure account linking"
        });
}


// =====================================================
// LINK BUTTON
// =====================================================

function createLinkButton() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId(
                    "n7link_link"
                )
                .setLabel(
                    "Link Account"
                )
                .setEmoji("🔗")
                .setStyle(
                    ButtonStyle.Primary
                )

        );
}


// =====================================================
// PROFILE EMBED
// =====================================================

function createProfileEmbed(
    minecraftUsername,
    minecraftUuid,
    linkedAt
) {

    return new EmbedBuilder()

        .setColor(0x0B0B0D)

        .setTitle(
            "🔗  Minecraft Profile"
        )

        .addFields(

            {
                name:
                    "Minecraft Username",

                value:
                    `\`${minecraftUsername}\``,

                inline: true
            },

            {
                name:
                    "Minecraft UUID",

                value:
                    `\`${minecraftUuid}\``,

                inline: false
            },

            {
                name:
                    "Linked",

                value:
                    `<t:${Math.floor(
                        new Date(linkedAt)
                            .getTime() / 1000
                    )}:R>`,

                inline: true
            }

        )

        .setFooter({
            text: "N7-Link"
        });
}


// =====================================================
// LINK MODAL
// =====================================================

function createLinkModal() {

    const modal =
        new ModalBuilder()
            .setCustomId(
                "n7link_modal"
            )
            .setTitle(
                "Link Minecraft Account"
            );

    const codeInput =
        new TextInputBuilder()
            .setCustomId(
                "n7link_code"
            )
            .setLabel(
                "Enter your 6-character link code"
            )
            .setPlaceholder(
                "Example: A7K921"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setMinLength(6)
            .setMaxLength(6)
            .setRequired(true);

    const row =
        new ActionRowBuilder()
            .addComponents(
                codeInput
            );

    modal.addComponents(row);

    return modal;
}


// =====================================================
// BOT READY
// =====================================================

client.once(
    Events.ClientReady,
    async readyClient => {

        console.log(
            `Logged in as ${readyClient.user.tag}`
        );

        try {

            await registerCommands();

        } catch (error
