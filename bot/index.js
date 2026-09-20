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
// RENDER HEALTH SERVER
// =====================================================

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.json({
        service: "N7-Link Discord Bot",
        status: "online"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Health server running on port ${PORT}`);
});


// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const API_URL = process.env.N7LINK_API_URL;
const API_SECRET = process.env.N7LINK_API_SECRET;

const LINKED_ROLE_ID =
    process.env.N7LINK_LINKED_ROLE_ID;


// =====================================================
// CHECK CONFIGURATION
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
    console.error("Missing N7LINK_LINKED_ROLE_ID");
    process.exit(1);
}


// =====================================================
// DISCORD CLIENT
// =====================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});


// =====================================================
// API HELPER
// =====================================================

async function apiRequest(endpoint, options = {}) {

    const response = await fetch(
        `${API_URL}${endpoint}`,
        {
            ...options,

            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${API_SECRET}`,
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
            "View your linked Minecraft account information"
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
// LINK EMBED
// =====================================================

function createLinkEmbed() {

    return new EmbedBuilder()

        .setColor(0x0B0B0D)

        .setTitle("🔗  Minecraft Account Linking")

        .setDescription(
            [
                "",
                "Link your Minecraft account",
                "to your Discord account.",
                "",
                "**How to link:**",
                "",
                "1. Join the Minecraft server.",
                "2. Type `/link` in Minecraft.",
                "3. Copy the 6-character code.",
                "4. Click **Link Account** below.",
                "5. Enter your code.",
                "",
                "Your code expires after **5 minutes**.",
                ""
            ].join("\n")
        )

        .setFooter({
            text: "N7-Link • Account Linking"
        });
}


// =====================================================
// LINK BUTTON
// =====================================================

function createLinkButton() {

    return new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId("n7link_link")
                .setLabel("Link Account")
                .setEmoji("🔗")
                .setStyle(ButtonStyle.Primary)

        );
}


// =====================================================
// LINK MODAL
// =====================================================

function createLinkModal() {

    const modal = new ModalBuilder()
        .setCustomId("n7link_modal")
        .setTitle("Minecraft Account Link");

    const codeInput = new TextInputBuilder()
        .setCustomId("n7link_code")
        .setLabel("Enter your 6-character link code")
        .setPlaceholder("Example: A7K921")
        .setStyle(TextInputStyle.Short)
        .setMinLength(6)
        .setMaxLength(6)
        .setRequired(true);

    const row = new ActionRowBuilder()
        .addComponents(codeInput);

    modal.addComponents(row);

    return modal;
}


// =====================================================
// PROFILE EMBED
// =====================================================

function createProfileEmbed(
    minecraftUsername,
    minecraftUuid,
    linkedAt
) {

    const timestamp = linkedAt
        ? Math.floor(
            new Date(linkedAt).getTime() / 1000
        )
        : null;

    return new EmbedBuilder()

        .setColor(0x0B0B0D)

        .setTitle("🔗  Minecraft Profile")

        .addFields(
            {
                name: "Minecraft Username",
                value: `\`${minecraftUsername}\``,
                inline: true
            },
            {
                name: "Minecraft UUID",
                value: `\`${minecraftUuid}\``,
                inline: false
            },
            {
                name: "Linked",
                value: timestamp
                    ? `<t:${timestamp}:R>`
                    : "Unknown",
                inline: true
            }
        )

        .setFooter({
            text: "N7-Link"
        });
}


// =====================================================
// READY
// =====================================================

client.once(
    Events.ClientReady,
    async readyClient => {

        console.log(
            `Logged in as ${readyClient.user.tag}`
        );

        try {

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

        } catch (error) {

            console.error(
                "Command registration failed:",
                error
            );
        }

        console.log(
            "N7-Link Discord bot is online!"
        );
    }
);


// =====================================================
// INTERACTION HANDLER
// =====================================================

client.on(
    Events.InteractionCreate,
    async interaction => {

        try {

            // =========================================
            // SLASH COMMANDS
            // =========================================

            if (interaction.isChatInputCommand()) {

                // /link
                if (
                    interaction.commandName === "link"
                ) {

                    await interaction.reply({
                        embeds: [
                            createLinkEmbed()
                        ],
                        components: [
                            createLinkButton()
                        ]
                    });

                    return;
                }


                // /profile
                if (
                    interaction.commandName === "profile"
                ) {

                    await showProfile(interaction);

                    return;
                }


                // /linkinfo
                if (
                    interaction.commandName === "linkinfo"
                ) {

                    await showLinkInfo(interaction);

                    return;
                }


                // /unlink
                if (
                    interaction.commandName === "unlink"
                ) {

                    await unlinkAccount(interaction);

                    return;
                }


                // /setup-link
                if (
                    interaction.commandName === "setup-link"
                ) {

                    if (
                        !interaction.member.permissions.has(
                            PermissionsBitField.Flags.ManageGuild
                        )
                    ) {

                        await interaction.reply({
                            content:
                                "❌ You need the **Manage Server** permission.",
                            ephemeral: true
                        });

                        return;
                    }

                    await interaction.channel.send({
                        embeds: [
                            createLinkEmbed()
                        ],
                        components: [
                            createLinkButton()
                        ]
                    });

                    await interaction.reply({
                        content:
                            "✅ N7-Link panel created.",
                        ephemeral: true
                    });

                    return;
                }
            }


            // =========================================
            // LINK BUTTON
            // =========================================

            if (
                interaction.isButton() &&
                interaction.customId === "n7link_link"
            ) {

                await interaction.showModal(
                    createLinkModal()
                );

                return;
            }


            // =========================================
            // LINK MODAL
            // =========================================

            if (
                interaction.isModalSubmit() &&
                interaction.customId === "n7link_modal"
            ) {

                await verifyLink(interaction);

                return;
            }

        } catch (error) {

            console.error(
                "Interaction error:",
                error
            );

            try {

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {

                    await interaction.followUp({
                        content:
                            "❌ Something went wrong. Please try again.",
                        ephemeral: true
                    });

                } else {

                    await interaction.reply({
                        content:
                            "❌ Something went wrong. Please try again.",
                        ephemeral: true
                    });
                }

            } catch {}
        }
    }
);


// =====================================================
// VERIFY LINK
// =====================================================

async function verifyLink(interaction) {

    const code =
        interaction.fields
            .getTextInputValue("n7link_code")
            .trim()
            .toUpperCase();

    await interaction.deferReply({
        ephemeral: true
    });

    const result = await apiRequest(
        "/api/link/verify",
        {
            method: "POST",

            body: JSON.stringify({
                discordId:
                    interaction.user.id,

                code
            })
        }
    );

    const data = result.data;

    if (result.status === 404) {

        await interaction.editReply({
            content:
                "❌ That code is invalid or has expired."
        });

        return;
    }

    if (result.status === 409) {

        await interaction.editReply({
            content:
                `❌ ${data.error || "This account is already linked."}`
        });

        return;
    }

    if (result.status !== 200 || !data.success) {

        console.error(
            "Link verification failed:",
            data
        );

        await interaction.editReply({
            content:
                "❌ The linking service could not process your request."
        });

        return;
    }

    const minecraftUsername =
        data.minecraft?.username || "Unknown";

    const minecraftUuid =
        data.minecraft?.uuid || "Unknown";


    // ================================================
    // ADD LINKED ROLE
    // ================================================

    let roleAdded = false;

    try {

        const guild = interaction.guild;

        if (guild) {

            const member =
                await guild.members.fetch(
                    interaction.user.id
                );

            const role =
                await guild.roles.fetch(
                    LINKED_ROLE_ID
                );

            if (
                role &&
                !member.roles.cache.has(role.id)
            ) {

                await member.roles.add(
                    role,
                    "N7-Link account linked"
                );

                roleAdded = true;
            }
        }

    } catch (error) {

        console.error(
            "Could not add Linked role:",
            error
        );
    }


    // ================================================
    // SUCCESS EMBED
    // ================================================

    const description = [
        "",
        `Your Minecraft account **${minecraftUsername}** has been successfully linked.`,
        "",
        "Your Minecraft and Discord accounts are now connected."
    ];

    if (roleAdded) {

        description.push(
            "",
            "You have also received the **Linked** role."
        );
    }

    description.push("");

    await interaction.editReply({

        embeds: [

            new EmbedBuilder()

                .setColor(0x0B0B0D)

                .setTitle(
                    "✅  Account Linked"
                )

                .setDescription(
                    description.join("\n")
                )

                .addFields({
                    name: "Minecraft Username",
                    value:
                        `\`${minecraftUsername}\``,
                    inline: true
                })

                .setFooter({
                    text: "N7-Link"
                })
        ]

    });
                          }
// =====================================================
// SHOW PROFILE
// =====================================================

async function showProfile(interaction) {

    await interaction.deferReply({
        ephemeral: true
    });

    const result = await apiRequest(
        `/api/link/discord/${interaction.user.id}`
    );

    const data = result.data;

    if (result.status !== 200) {

        await interaction.editReply({
            content:
                "❌ Could not contact the N7-Link API."
        });

        return;
    }

    if (!data.linked) {

        await interaction.editReply({

            embeds: [

                new EmbedBuilder()

                    .setColor(0x0B0B0D)

                    .setTitle(
                        "🔗  Minecraft Profile"
                    )

                    .setDescription(
                        [
                            "",
                            "You don't have a linked Minecraft account.",
                            "",
                            "Use `/link` to link your account.",
                            ""
                        ].join("\n")
                    )

                    .setFooter({
                        text: "N7-Link"
                    })

            ]

        });

        return;
    }

    await interaction.editReply({

        embeds: [

            createProfileEmbed(
                data.minecraft.username,
                data.minecraft.uuid,
                data.linkedAt
            )

        ]

    });
}


// =====================================================
// SHOW LINK INFO
// =====================================================

async function showLinkInfo(interaction) {

    await interaction.deferReply({
        ephemeral: true
    });

    const result = await apiRequest(
        `/api/link/discord/${interaction.user.id}`
    );

    const data = result.data;

    if (result.status !== 200) {

        await interaction.editReply({
            content:
                "❌ Could not contact the N7-Link API."
        });

        return;
    }

    if (!data.linked) {

        await interaction.editReply({
            content:
                "❌ Your Discord account is not linked."
        });

        return;
    }

    const timestamp = data.linkedAt
        ? Math.floor(
            new Date(data.linkedAt).getTime() / 1000
        )
        : null;

    const embed =
        new EmbedBuilder()

            .setColor(0x0B0B0D)

            .setTitle(
                "🔗  N7-Link Information"
            )

            .addFields(
                {
                    name: "Minecraft Username",
                    value:
                        `\`${data.minecraft.username}\``,
                    inline: true
                },
                {
                    name: "Minecraft UUID",
                    value:
                        `\`${data.minecraft.uuid}\``,
                    inline: false
                },
                {
                    name: "Reward",
                    value:
                        data.rewardClaimed
                            ? "Claimed"
                            : "Not claimed",
                    inline: true
                },
                {
                    name: "Linked At",
                    value:
                        timestamp
                            ? `<t:${timestamp}:F>`
                            : "Unknown",
                    inline: false
                }
            )

            .setFooter({
                text: "N7-Link"
            });

    await interaction.editReply({
        embeds: [embed]
    });
}


// =====================================================
// UNLINK ACCOUNT
// =====================================================

async function unlinkAccount(interaction) {

    await interaction.deferReply({
        ephemeral: true
    });

    const result = await apiRequest(
        "/api/link/unlink",
        {
            method: "POST",

            body: JSON.stringify({
                discordId:
                    interaction.user.id
            })
        }
    );

    const data = result.data;

    if (result.status === 404) {

        await interaction.editReply({
            content:
                "❌ Your Discord account is not linked."
        });

        return;
    }

    if (result.status !== 200 || !data.success) {

        await interaction.editReply({
            content:
                "❌ Could not unlink your account."
        });

        return;
    }


    // ================================================
    // REMOVE LINKED ROLE
    // ================================================

    try {

        const guild = interaction.guild;

        if (guild) {

            const member =
                await guild.members.fetch(
                    interaction.user.id
                );

            const role =
                await guild.roles.fetch(
                    LINKED_ROLE_ID
                );

            if (
                role &&
                member.roles.cache.has(role.id)
            ) {

                await member.roles.remove(
                    role,
                    "N7-Link account unlinked"
                );
            }
        }

    } catch (error) {

        console.error(
            "Could not remove Linked role:",
            error
        );
    }


    // ================================================
    // SUCCESS
    // ================================================

    await interaction.editReply({

        embeds: [

            new EmbedBuilder()

                .setColor(0x0B0B0D)

                .setTitle(
                    "🔓  Account Unlinked"
                )

                .setDescription(
                    [
                        "",
                        "Your Minecraft account has been unlinked from Discord.",
                        "",
                        "You can link another account at any time using `/link`.",
                        ""
                    ].join("\n")
                )

                .setFooter({
                    text: "N7-Link"
                })
        ]

    });
}


// =====================================================
// LOGIN
// =====================================================

client.login(TOKEN)
    .then(() => {

        console.log(
            "Discord login successful."
        );

    })
    .catch(error => {

        console.error(
            "Discord login failed:",
            error
        );

        process.exit(1);
    });
