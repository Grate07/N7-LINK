package me.n7link;

import com.google.inject.Inject;
import com.velocitypowered.api.command.CommandManager;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import net.kyori.adventure.text.Component;
import org.slf4j.Logger;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Scanner;

@Plugin(
        id = "n7link",
        name = "N7-Link",
        version = "1.0.0",
        description = "Minecraft to Discord account linking system",
        authors = {"N7"}
)
public class N7Link {

    private final ProxyServer server;
    private final Logger logger;
    private final SecureRandom random = new SecureRandom();

    private String apiUrl;
    private String apiSecret;

    private int codeLength;
    private int codeExpiryMinutes;

    @Inject
    public N7Link(
            ProxyServer server,
            Logger logger
    ) {
        this.server = server;
        this.logger = logger;
    }

    @Subscribe
    public void onProxyInitialization(
            ProxyInitializeEvent event
    ) {

        loadConfiguration();

        CommandManager commandManager =
                server.getCommandManager();

        commandManager.register(
                commandManager.metaBuilder("link")
                        .plugin(this)
                        .build(),
                new LinkCommand()
        );

        logger.info("N7-Link has been enabled!");
        logger.info("N7-Link account linking command registered!");
        logger.info("N7-Link supports Java and Bedrock players.");
    }

    // =====================================================
    // CONFIGURATION
    // =====================================================

    private void loadConfiguration() {

        apiUrl =
                System.getenv("N7LINK_API_URL");

        apiSecret =
                System.getenv("N7LINK_API_SECRET");

        codeLength = 6;
        codeExpiryMinutes = 5;

        if (
                apiUrl == null ||
                apiUrl.isBlank()
        ) {

            logger.warn(
                    "N7LINK_API_URL is not configured!"
            );
        }

        if (
                apiSecret == null ||
                apiSecret.isBlank()
        ) {

            logger.warn(
                    "N7LINK_API_SECRET is not configured!"
            );
        }
    }

    // =====================================================
    // LINK COMMAND
    // =====================================================

    private class LinkCommand
            implements SimpleCommand {

        @Override
        public void execute(
                Invocation invocation
        ) {

            if (
                    !(invocation.source()
                            instanceof Player player)
            ) {

                invocation.source().sendMessage(
                        Component.text(
                                "Only players can use this command."
                        )
                );

                return;
            }

            if (
                    apiUrl == null ||
                    apiUrl.isBlank() ||
                    apiSecret == null ||
                    apiSecret.isBlank()
            ) {

                player.sendMessage(
                        Component.text(
                                "§cN7-Link is not configured correctly."
                        )
                );

                return;
            }

            player.sendMessage(
                    Component.text(
                            "§7Generating your linking code..."
                    )
            );

            server.getScheduler()
                    .buildTask(
                            thisPlugin(),
                            () -> createLinkCode(player)
                    )
                    .schedule();
        }
    }

    // =====================================================
    // CREATE LINK CODE
    // =====================================================

    private void createLinkCode(
            Player player
    ) {

        String code =
                generateCode();

        try {

            URI uri =
                    URI.create(
                            apiUrl +
                            "/api/link/create"
                    );

            HttpURLConnection connection =
                    (HttpURLConnection)
                            uri.toURL()
                                    .openConnection();

            connection.setRequestMethod("POST");

            connection.setRequestProperty(
                    "Content-Type",
                    "application/json"
            );

            connection.setRequestProperty(
                    "Authorization",
                    "Bearer " + apiSecret
            );

            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setDoOutput(true);

            String json = """
                    {
                      "minecraftUuid": "%s",
                      "minecraftUsername": "%s",
                      "code": "%s"
                    }
                    """.formatted(
                    player.getUniqueId(),
                    escapeJson(
                            player.getUsername()
                    ),
                    code
            );

            try (
                    OutputStream output =
                            connection.getOutputStream()
            ) {

                output.write(
                        json.getBytes(
                                StandardCharsets.UTF_8
                        )
                );
            }

            int responseCode =
                    connection.getResponseCode();

            if (responseCode == 200) {

                sendLinkMessage(
                        player,
                        code
                );

                logger.info(
                        "Created link code {} for {}",
                        code,
                        player.getUsername()
                );

            } else {

                String response =
                        readResponse(connection);

                logger.warn(
                        "N7-Link API returned HTTP {}: {}",
                        responseCode,
                        response
                );

                player.sendMessage(
                        Component.text(
                                "§cCould not create your linking code."
                        )
                );
            }

            connection.disconnect();

        } catch (Exception error) {

            logger.warn(
                    "Could not connect to N7-Link API: {}",
                    error.getMessage()
            );

            player.sendMessage(
                    Component.text(
                            "§cCould not connect to the N7-Link service."
                    )
            );
        }
    }

    // =====================================================
    // LINK MESSAGE
    // =====================================================

    private void sendLinkMessage(
            Player player,
            String code
    ) {

        player.sendMessage(
                Component.text(
                        "§8§m----------------------------"
                )
        );

        player.sendMessage(
                Component.text(
                        "§b§lN7-LINK §7| Account Linking"
                )
        );

        player.sendMessage(
                Component.text("")
        );

        player.sendMessage(
                Component.text(
                        "§fYour linking code:"
                )
        );

        player.sendMessage(
                Component.text(
                        "§b§l" + code
                )
        );

        player.sendMessage(
                Component.text("")
        );

        player.sendMessage(
                Component.text(
                        "§7Open the N7-Link Discord"
                )
        );

        player.sendMessage(
                Component.text(
                        "§7and enter this code in the"
                )
        );

        player.sendMessage(
                Component.text(
                        "§7§nLink Account§7 button."
                )
        );

        player.sendMessage(
                Component.text("")
        );

        player.sendMessage(
                Component.text(
                        "§7This code expires after §f"
                                + codeExpiryMinutes
                                + " minutes§7."
                )
        );

        player.sendMessage(
                Component.text(
                        "§8§m----------------------------"
                )
        );
    }

    // =====================================================
    // CODE GENERATOR
    // =====================================================

    private String generateCode() {

        String characters =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        StringBuilder code =
                new StringBuilder();

        for (
                int i = 0;
                i < codeLength;
                i++
        ) {

            code.append(
                    characters.charAt(
                            random.nextInt(
                                    characters.length()
                            )
                    )
            );
        }

        return code.toString();
    }

    // =====================================================
    // RESPONSE READER
    // =====================================================

    private String readResponse(
            HttpURLConnection connection
    ) {

        try {

            InputStream stream;

            if (
                    connection.getErrorStream()
                            != null
            ) {

                stream =
                        connection.getErrorStream();

            } else {

                stream =
                        connection.getInputStream();
            }

            try (
                    Scanner scanner =
                            new Scanner(
                                    stream,
                                    StandardCharsets.UTF_8
                            )
            ) {

                return scanner
                        .useDelimiter("\\A")
                        .hasNext()
                        ? scanner.next()
                        : "";
            }

        } catch (Exception ignored) {

            return "";
        }
    }

    // =====================================================
    // JSON ESCAPE
    // =====================================================

    private String escapeJson(
            String text
    ) {

        return text
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }

    // =====================================================
    // PLUGIN INSTANCE
    // =====================================================

    private N7Link thisPlugin() {
        return N7Link.this;
    }
}
