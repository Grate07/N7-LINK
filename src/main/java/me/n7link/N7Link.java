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

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

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

    @Inject
    public N7Link(
            ProxyServer server,
            Logger logger
    ) {
        this.server = server;
        this.logger = logger;
    }

    @Subscribe
    public void onProxyInitialization(ProxyInitializeEvent event) {

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

    private void loadConfiguration() {

        apiUrl = System.getenv("N7LINK_API_URL");
        apiSecret = System.getenv("N7LINK_API_SECRET");

        if (apiUrl == null || apiUrl.isBlank()) {
            logger.warn("N7LINK_API_URL is not configured!");
        }

        if (apiSecret == null || apiSecret.isBlank()) {
            logger.warn("N7LINK_API_SECRET is not configured!");
        }
    }

    private class LinkCommand implements SimpleCommand {

        @Override
        public void execute(Invocation invocation) {

            if (!(invocation.source() instanceof Player player)) {

                invocation.source().sendMessage(
                        Component.text(
                                "Only players can use this command."
                        )
                );

                return;
            }

            if (apiUrl == null || apiUrl.isBlank()
                    || apiSecret == null || apiSecret.isBlank()) {

                player.sendMessage(
                        Component.text(
                                "§cN7-Link is not configured correctly."
                        )
                );

                return;
            }

            String code = generateCode();

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
                            "§7Go to the N7-Link Discord"
                    )
            );

            player.sendMessage(
                    Component.text(
                            "§7and use §f/link code:" + code
                    )
            );

            player.sendMessage(
                    Component.text("")
            );

            player.sendMessage(
                    Component.text(
                            "§7This code expires after §f5 minutes§7."
                    )
            );

            player.sendMessage(
                    Component.text(
                            "§8§m----------------------------"
                    )
            );

            sendCodeToApi(player, code);
        }
    }

    private String generateCode() {

        String characters =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        StringBuilder code = new StringBuilder();

        for (int i = 0; i < 6; i++) {

            code.append(
                    characters.charAt(
                            random.nextInt(characters.length())
                    )
            );
        }

        return code.toString();
    }

    private void sendCodeToApi(
            Player player,
            String code
    ) {

        server.getScheduler()
                .buildTask(this, () -> {

                    try {

                        URI uri = URI.create(
                                apiUrl + "/api/link/create"
                        );

                        HttpURLConnection connection =
                                (HttpURLConnection)
                                        uri.toURL().openConnection();

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
                                escapeJson(player.getUsername()),
                                code
                        );

                        try (OutputStream output =
                                     connection.getOutputStream()) {

                            output.write(
                                    json.getBytes(
                                            StandardCharsets.UTF_8
                                    )
                            );
                        }

                        int responseCode =
                                connection.getResponseCode();

                        if (responseCode != 200) {

                            logger.warn(
                                    "N7-Link API returned HTTP {}",
                                    responseCode
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

                })
                .schedule();
    }

    private String escapeJson(String text) {

        return text
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
                                    }
