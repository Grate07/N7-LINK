package me.n7link;

import com.google.inject.Inject;
import com.velocitypowered.api.command.CommandManager;
import com.velocitypowered.api.command.SimpleCommand;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.DisconnectEvent;
import com.velocitypowered.api.event.connection.PostLoginEvent;
import com.velocitypowered.api.event.proxy.ProxyInitializeEvent;
import com.velocitypowered.api.event.proxy.ProxyShutdownEvent;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.proxy.ServerConnection;
import com.velocitypowered.api.proxy.messages.MinecraftChannelIdentifier;
import net.kyori.adventure.text.Component;
import org.slf4j.Logger;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.Scanner;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

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

    private boolean rewardsEnabled;
    private String rewardMessage;
    private List<String> rewardCommands;

    private final Map<UUID, Boolean> rewardChecking =
            new ConcurrentHashMap<>();

    private static final MinecraftChannelIdentifier REWARD_CHANNEL =
            MinecraftChannelIdentifier.create(
                    "n7link",
                    "reward"
            );

    @Inject
    public N7Link(
            ProxyServer server,
            Logger logger
    ) {
        this.server = server;
        this.logger = logger;
    }

    // =====================================================
    // ENABLE
    // =====================================================

    @Subscribe
    public void onProxyInitialization(
            ProxyInitializeEvent event
    ) {

        loadConfiguration();

        server.getChannelRegistrar()
                .register(REWARD_CHANNEL);

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

        if (rewardsEnabled) {
            logger.info("N7-Link rewards are enabled.");
        } else {
            logger.info("N7-Link rewards are disabled.");
        }
    }

    // =====================================================
    // DISABLE
    // =====================================================

    @Subscribe
    public void onDisable(
            ProxyShutdownEvent event
    ) {

        server.getChannelRegistrar()
                .unregister(REWARD_CHANNEL);

        rewardChecking.clear();

        logger.info("N7-Link has been disabled.");
    }

    // =====================================================
    // PLAYER LOGIN
    // =====================================================

    @Subscribe
    public void onPlayerLogin(
            PostLoginEvent event
    ) {

        if (!rewardsEnabled) {
            return;
        }

        Player player =
                event.getPlayer();

        server.getScheduler()
                .buildTask(
                        this,
                        () -> checkReward(player)
                )
                .delay(
                        3,
                        TimeUnit.SECONDS
                )
                .schedule();
    }

    // =====================================================
    // PLAYER DISCONNECT
    // =====================================================

    @Subscribe
    public void onPlayerDisconnect(
            DisconnectEvent event
    ) {

        rewardChecking.remove(
                event.getPlayer().getUniqueId()
        );
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

        rewardsEnabled = true;

        rewardMessage =
                "&aThanks for linking your Discord account!";

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
                            N7Link.this,
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
                    escapeJson(player.getUsername()),
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

                if (responseCode == 409) {

                    player.sendMessage(
                            Component.text(
                                    "§cYour Minecraft account is already linked."
                            )
                    );

                } else {

                    player.sendMessage(
                            Component.text(
                                    "§cCould not create your linking code."
                            )
                    );
                }
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
                        "§7and click the §fLink Account§7 button."
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
    // REWARD CHECK
    // =====================================================

    private void checkReward(
            Player player
    ) {

        if (!player.isActive()) {
            return;
        }

        if (!rewardsEnabled) {
            return;
        }

        UUID uuid =
                player.getUniqueId();

        if (
                rewardChecking.putIfAbsent(
                        uuid,
                        true
                ) != null
        ) {
            return;
        }

        try {

            LinkStatus status =
                    getMinecraftLink(uuid);

            if (
                    status == null ||
                    !status.linked
            ) {
                return;
            }

            if (status.rewardClaimed) {
                return;
            }

            sendReward(
                    player,
                    status
            );

        } finally {

            rewardChecking.remove(uuid);
        }
    }

    // =====================================================
    // GET MINECRAFT LINK
    // =====================================================

    private LinkStatus getMinecraftLink(
            UUID uuid
    ) {

        HttpURLConnection connection = null;

        try {

            URI uri =
                    URI.create(
                            apiUrl +
                            "/api/link/minecraft/" +
                            uuid
                    );

            connection =
                    (HttpURLConnection)
                            uri.toURL()
                                    .openConnection();

            connection.setRequestMethod("GET");

            connection.setRequestProperty(
                    "Authorization",
                    "Bearer " + apiSecret
            );

            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            int responseCode =
                    connection.getResponseCode();

            if (responseCode != 200) {
                return null;
            }

            String response =
                    readResponse(connection);

            boolean linked =
                    response.contains(
                            "\"linked\":true"
                    );

            boolean rewardClaimed =
                    response.contains(
                            "\"rewardClaimed\":true"
                    );

            String username =
                    extractJsonValue(
                            response,
                            "minecraftUsername"
                    );

            return new LinkStatus(
                    linked,
                    rewardClaimed,
                    username
            );

        } catch (Exception error) {

            logger.warn(
                    "Could not check reward status for {}: {}",
                    uuid,
                    error.getMessage()
            );

            return null;

        } finally {

            if (connection != null) {
                connection.disconnect();
            }
        }
        }
            // =====================================================
    // SEND REWARD TO PAPER
    // =====================================================

    private void sendReward(
            Player player,
            LinkStatus status
    ) {

        if (
                player.getCurrentServer()
                        .isEmpty()
        ) {

            return;
        }

        ServerConnection serverConnection =
                player.getCurrentServer()
                        .get();

        try {

            ByteArrayOutputStream bytes =
                    new ByteArrayOutputStream();

            DataOutputStream output =
                    new DataOutputStream(bytes);

            output.writeUTF(
                    "N7LINK_REWARD_V1"
            );

            output.writeUTF(
                    player.getUniqueId()
                            .toString()
            );

            output.writeUTF(
                    player.getUsername()
            );

            // Number of reward commands
            output.writeInt(1);

            // Temporary reward command
            output.writeUTF(
                    "give %player% diamond 5"
            );

            // Reward message
            output.writeUTF(
                    rewardMessage
            );

            output.flush();

            boolean sent =
                    serverConnection
                            .sendPluginMessage(
                                    REWARD_CHANNEL,
                                    bytes.toByteArray()
                            );

            if (!sent) {

                logger.warn(
                        "Could not send reward to Paper for {}",
                        player.getUsername()
                );

                return;
            }

            claimReward(player);

        } catch (Exception error) {

            logger.warn(
                    "Could not send reward for {}: {}",
                    player.getUsername(),
                    error.getMessage()
            );
        }
    }

    // =====================================================
    // CLAIM REWARD
    // =====================================================

    private void claimReward(
            Player player
    ) {

        HttpURLConnection connection = null;

        try {

            URI uri =
                    URI.create(
                            apiUrl +
                            "/api/link/minecraft/" +
                            player.getUniqueId() +
                            "/reward-claim"
                    );

            connection =
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

            connection.getOutputStream().close();

            int responseCode =
                    connection.getResponseCode();

            if (responseCode == 200) {

                logger.info(
                        "Reward claimed for {}",
                        player.getUsername()
                );

            } else if (responseCode == 409) {

                logger.info(
                        "Reward was already claimed for {}",
                        player.getUsername()
                );

            } else {

                logger.warn(
                        "Reward claim returned HTTP {}",
                        responseCode
                );
            }

        } catch (Exception error) {

            logger.warn(
                    "Could not claim reward for {}: {}",
                    player.getUsername(),
                    error.getMessage()
            );

        } finally {

            if (connection != null) {
                connection.disconnect();
            }
        }
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
    // JSON VALUE READER
    // =====================================================

    private String extractJsonValue(
            String json,
            String key
    ) {

        String search =
                "\"" + key + "\":";

        int start =
                json.indexOf(search);

        if (start == -1) {
            return null;
        }

        start += search.length();

        while (
                start < json.length() &&
                Character.isWhitespace(
                        json.charAt(start)
                )
        ) {

            start++;
        }

        if (
                start >= json.length() ||
                json.charAt(start) != '"'
        ) {

            return null;
        }

        start++;

        int end =
                json.indexOf(
                        '"',
                        start
                );

        if (end == -1) {
            return null;
        }

        return json.substring(
                start,
                end
        );
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
    // LINK STATUS
    // =====================================================

    private static class LinkStatus {

        private final boolean linked;
        private final boolean rewardClaimed;
        private final String minecraftUsername;

        private LinkStatus(
                boolean linked,
                boolean rewardClaimed,
                String minecraftUsername
        ) {

            this.linked =
                    linked;

            this.rewardClaimed =
                    rewardClaimed;

            this.minecraftUsername =
                    minecraftUsername;
        }
    }
        }
