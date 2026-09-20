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
// CONFIGURATION
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const API_URL = process.env.N7LINK_API_URL;
const API_SECRET = process.env.N7LINK_API_SECRET;

const LINKED_ROLE_ID = process.env.N7LINK_LINKED_ROLE_ID;


// =====================================================
// VALIDATION
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
        GatewayIntentBits.Guilds
    ]
});


// =====================================================
// API HELPER
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
// COMMANDS
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

    console.log("Registering N7-Link commands...");

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
            text: "N7-Link • Secure account linking"
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
// PROFILE EMBED
// =====================================================

function createProfileEmbed(
    minecraftUsername,
    minecraftUuid,
    linkedAt
) {

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
                value: `<t:${Math.floor(
                    new Date(linkedAt).getTime() / 1000
                )}:R>`,
                inline: true
            }
        )

        .setFooter({
            text: "N7-Link"
        });
}


// =====================================================
// MODAL
// =====================================================

function createLinkModal() {

    const modal = new ModalBuilder()
        .setCustomId("n7link_modal")
        .setTitle("Link Minecraft Account");

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
// READY
// =====================================================

client.once(
    Events.ClientReady,
    async readyClient => {

        console.log(
            `Logged in as ${readyClient.user.tag}`
        );

        try {

            await registerCommands();

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
// INTERACTIONS
// =====================================================

client.on(
    Events.InteractionCreate,
    async interaction => {

        try {

            // ---------------------------------------------
            // SLASH COMMANDS
            // ---------------------------------------------

            if (interaction.isChatInputCommand()) {

                // /link
                if (interaction.commandName === "link") {

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
                    interaction.commandName ===
                    "profile"
                ) {

                    await showProfile(
                        interaction
                    );

                    return;
                }


                // /linkinfo
                if (
                    interaction.commandName ===
                    "linkinfo"
                ) {

                    await showProfile(
                        interaction
                    );

                    return;
                }


                // /unlink
                if (
                    interaction.commandName ===
                    "unlink"
                ) {

                    await unlinkAccount(
                        interaction
                    );

                    return;
                }


                // /setup-link
                if (
                    interaction.commandName ===
                    "setup-link"
                ) {

                    if (
                        !interaction.member.permissions
                            .has(
                                PermissionsBitField.Flags.ManageGuild
                            )
                    ) {

                        await interaction.reply({
                            content:
                                "You need the **Manage Server** permission to use this command.",
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
                            "N7-Link panel created.",
                        ephemeral: true
                    });

                    return;
                }
            }


            // ---------------------------------------------
            // LINK BUTTON
            // ---------------------------------------------

            if (
                interaction.isButton() &&
                interaction.customId ===
                    "n7link_link"
            ) {

                await interaction.showModal(
                    createLinkModal()
                );

                return;
            }


            // ---------------------------------------------
            // LINK MODAL
            // ---------------------------------------------

            if (
                interaction.isModalSubmit() &&
                interaction.customId ===
                    "n7link_modal"
            ) {

                await verifyLink(
                    interaction
                );

                return;
            }

        } catch (error) {

            console.error(
                "Interaction error:",
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                await interaction.followUp({
                    content:
                        "Something went wrong. Please try again.",
                    ephemeral: true
                });

            } else {

                await interaction.reply({
                    content:
                        "Something went wrong. Please try again.",
                    ephemeral: true
                });
            }
        }
    }
);


// =====================================================
// VERIFY LINK
// =====================================================

async function verifyLink(
    interaction
) {

    const code =
        interaction.fields
            .getTextInputValue(
                "n7link_code"
            )
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


    // Invalid / expired code
    if (result.status === 404) {

        await interaction.editReply({
            content:
                "❌ That code is invalid or has expired."
        });

        return;
    }


    // Already linked
    if (result.status === 409) {

        await interaction.editReply({
            content:
                `❌ ${data.error}`
        });

        return;
    }


    // API error
    if (
        !data.success
    ) {

        await interaction.editReply({
            content:
                "❌ The linking service could not process your request."
        });

        return;
    }


    // ---------------------------------------------
    // ADD LINKED ROLE
    // ---------------------------------------------

    let roleAdded = false;

    try {

        const guild =
            interaction.guild;

        if (guild) {

            const member =
                await guild.members.fetch(
                    interaction.user.id
                );

            const role =
                await guild.roles.fetch(
                    LINKED_ROLE_ID
                );

            if (role && !member.roles.cache.has(role.id)) {

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


    // ---------------------------------------------
    // SUCCESS
    // ---------------------------------------------

    const roleMessage =
        roleAdded
            ? "\n\nYou have also received the **Linked** role."
            : "";

    await interaction.editReply({

        embeds: [

            new EmbedBuilder()

                .setColor(0x0B0B0D)

                .setTitle(
                    "✅  Account Linked"
                )

                .setDescription(
                    [
                        "",
                        `Minecraft account **${data.minecraftUsername}** has been successfully linked.`,
                        "",
                        "Your Discord and Minecraft accounts are now connected.",
                        roleMessage,
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
// PROFILE
// =====================================================

async function showProfile(
    interaction
) {

    await interaction.deferReply({
        ephemeral: true
    });

    const result =
        await apiRequest(
            `/api/link/${interaction.user.id}`
        );

    const data =
        result.data;


    if (
        !data.success
    ) {

        await interaction.editReply({
            content:
                "❌ Could not contact the N7-Link API."
        });

        return;
    }


    if (
        !data.linked
    ) {

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
                data.minecraftUsername,
                data.minecraftUuid,
                data.linkedAt
            )

        ]
    });
}


// =====================================================
// UNLINK
// =====================================================

async function unlinkAccount(
    interaction
) {

    await interaction.deferReply({
        ephemeral: true
    });

    const result =
        await apiRequest(
            `/api/link/${interaction.user.id}`,
            {
                method: "DELETE"
            }
        );

    const data =
        result.data;


    if (
        result.status === 404
    ) {

        await interaction.editReply({
            content:
                "❌ You don't have a linked Minecraft account."
        });

        return;
    }


    if (
        !data.success
    ) {

        await interaction.editReply({
            content:
                "❌ Could not unlink your account."
        });

        return;
    }


    // Remove Linked role
    try {

        if (interaction.guild) {

            const member =
                await interaction.guild.members.fetch(
                    interaction.user.id
                );

            const role =
                await interaction.guild.roles.fetch(
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


    await interaction.editReply({
        content:
            "✅ Your Minecraft account has been unlinked."
    });
}


// =====================================================
// LOGIN
// =====================================================

client.login(TOKEN);
