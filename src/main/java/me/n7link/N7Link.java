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
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.proxy.ServerConnection;
import com.velocitypowered.api.proxy.messages.MinecraftChannelIdentifier;
import net.kyori.adventure.text.Component;
import org.slf4j.Logger;
import org.spongepowered.configurate.ConfigurationNode;
import org.spongepowered.configurate.yaml.YamlConfigurationLoader;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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
    private final Path dataDirectory;
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


    // =====================================================
    // CONSTRUCTOR
    // =====================================================

    @Inject
    public N7Link(
            ProxyServer server,
            Logger logger,
            @DataDirectory Path dataDirectory
    ) {

        this.server = server;
        this.logger = logger;
        this.dataDirectory = dataDirectory;
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
        logger.info(
                "N7-Link account linking command registered!"
        );
        logger.info(
                "N7-Link supports Java and Bedrock players."
        );

        if (rewardsEnabled) {
            logger.info(
                    "N7-Link rewards are enabled."
            );
        } else {
            logger.info(
                    "N7-Link rewards are disabled."
            );
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

        logger.info(
                "N7-Link has been disabled."
        );
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

        try {

            if (!Files.exists(dataDirectory)) {
                Files.createDirectories(dataDirectory);
            }

            Path configFile =
                    dataDirectory.resolve("config.yml");

            if (!Files.exists(configFile)) {

                try (
                        InputStream input =
                                N7Link.class
                                        .getResourceAsStream(
                                                "/config.yml"
                                        )
                ) {

                    if (input == null) {

                        logger.error(
                                "Could not find config.yml inside the plugin JAR!"
                        );

                        return;
                    }

                    Files.copy(
                            input,
                            configFile
                    );
                }
            }

            YamlConfigurationLoader loader =
                    YamlConfigurationLoader.builder()
                            .path(configFile)
                            .build();

            ConfigurationNode config =
                    loader.load();

            apiUrl =
                    config.node("api", "url")
                            .getString("");

            apiSecret =
                    config.node("api", "secret")
                            .getString("");

            codeLength =
                    config.node("link", "code-length")
                            .getInt(6);

            codeExpiryMinutes =
                    config.node(
                                    "link",
                                    "code-expiry-minutes"
                            )
                            .getInt(5);

            rewardsEnabled =
                    config.node(
                                    "rewards",
                                    "enabled"
                            )
                            .getBoolean(true);

            rewardMessage =
                    config.node(
                                    "rewards",
                                    "message"
                            )
                            .getString(
                                    "&aThanks for linking your Discord account!"
                            );

            rewardCommands =
                    config.node(
                                    "rewards",
                                    "commands"
                            )
                            .getList(
                                    String.class,
                                    List.of()
                            );

            logger.info(
                    "N7-Link configuration loaded."
            );

            logger.info(
                    "Link code length: {}",
                    codeLength
            );

            logger.info(
                    "Link code expiry: {} minutes",
                    codeExpiryMinutes
            );

            logger.info(
                    "Rewards enabled: {}",
                    rewardsEnabled
            );

            logger.info(
                    "Reward commands loaded: {}",
                    rewardCommands.size()
            );

            if (
                    apiUrl == null ||
                    apiUrl.isBlank()
            ) {

                logger.warn(
                        "api.url is not configured!"
                );
            }

            if (
                    apiSecret == null ||
                    apiSecret.isBlank()
            ) {

                logger.warn(
                        "api.secret is not configured!"
                );
            }

        } catch (Exception error) {

            logger.error(
                    "Could not load N7-Link configuration!",
                    error
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

        HttpURLConnection connection = null;

        try {

            URI uri =
                    URI.create(
                            apiUrl +
                            "/api/link/create"
                    );

            connection =
                    (HttpURLConnection)
                            uri.toURL()
                                    .openConnection();

            connection.setRequestMethod(
                    "POST"
            );

            connection.setRequestProperty(
                    "Content-Type",
                    "application/json"
            );

            connection.setRequestProperty(
                    "Authorization",
                    "Bearer " + apiSecret
            );

            connection.setConnectTimeout(
                    10000
            );

            connection.setReadTimeout(
                    10000
            );

            connection.setDoOutput(
                    true
            );

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
                        readResponse(
                                connection
                        );

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

        } finally {

            if (connection != null) {
                connection.disconnect();
            }
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

            connection.setRequestMethod(
                    "GET"
            );

            connection.setRequestProperty(
                    "Authorization",
                    "Bearer " + apiSecret
            );

            connection.setConnectTimeout(
                    10000
            );

            connection.setReadTimeout(
                    10000
            );

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
    // SEND REWARD
    // =====================================================

    private void sendReward(
            Player player,
            LinkStatus status
    ) {

        if (!player.isActive()) {
            return;
        }

        if (!rewardsEnabled) {
            return;
        }

        Optional<ServerConnection> serverConnection =
                player.getCurrentServer();

        if (serverConnection.isEmpty()) {

            logger.warn(
                    "Could not send reward to {} because the player is not connected to a server.",
                    player.getUsername()
            );

            return;
        }

        try {

            ByteArrayOutputStream byteOutput =
                    new ByteArrayOutputStream();

            DataOutputStream output =
                    new DataOutputStream(
                            byteOutput
                    );

            /*
             * Packet format:
             *
             * UTF  -> Action
             * UTF  -> Minecraft UUID
             * UTF  -> Minecraft username
             * INT  -> Number of reward commands
             * UTF  -> Each command
             * UTF  -> Reward message
             */

            output.writeUTF(
                    "N7LINK_REWARD_V1"
            );

            output.writeUTF(
                    player.getUniqueId().toString()
            );

            output.writeUTF(
                    player.getUsername()
            );

            List<String> processedCommands =
                    rewardCommands == null
                            ? List.of()
                            : rewardCommands.stream()
                                    .map(command ->
                                            command
                                                    .replace(
                                                            "%player%",
                                                            player.getUsername()
                                                    )
                                                    .replace(
                                                            "%uuid%",
                                                            player.getUniqueId().toString()
                                                    )
                                    )
                                    .toList();

            output.writeInt(
                    processedCommands.size()
            );

            for (
                    String command :
                    processedCommands
            ) {

                output.writeUTF(
                        command
                );
            }

            String processedMessage =
                    rewardMessage == null
                            ? ""
                            : rewardMessage
                                    .replace(
                                            "%player%",
                                            player.getUsername()
                                    )
                                    .replace(
                                            "%uuid%",
                                            player.getUniqueId().toString()
                                    );

            output.writeUTF(
                    processedMessage
            );

            output.flush();

            byte[] message =
                    byteOutput.toByteArray();

            boolean sent =
                    serverConnection
                            .get()
                            .sendPluginMessage(
                                    REWARD_CHANNEL,
                                    message
                            );

            if (!sent) {

                logger.warn(
                        "Velocity could not send reward packet to Paper for {}.",
                        player.getUsername()
                );

                return;
            }

            logger.info(
                    "Sent N7-Link reward packet to Paper for {}.",
                    player.getUsername()
            );

            /*
             * The Paper bridge receives the packet and executes
             * the configured reward commands.
             *
             * We only claim the reward after the packet has
             * successfully been sent by Velocity.
             */

            server.getScheduler()
                    .buildTask(
                            this,
                            () -> claimReward(
                                    player
                            )
                    )
                    .delay(
                            1,
                            TimeUnit.SECONDS
                    )
                    .schedule();

        } catch (Exception error) {

            logger.warn(
                    "Could not send N7-Link reward to {}: {}",
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

        if (!player.isActive()) {
            return;
        }

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

            connection.setRequestMethod(
                    "POST"
            );

            connection.setRequestProperty(
                    "Authorization",
                    "Bearer " + apiSecret
            );

            connection.setRequestProperty(
                    "Content-Type",
                    "application/json"
            );

            connection.setConnectTimeout(
                    10000
            );

            connection.setReadTimeout(
                    10000
            );

            connection.setDoOutput(
                    true
            );

            try (
                    OutputStream output =
                            connection.getOutputStream()
            ) {

                output.write(
                        "{}".getBytes(
                                StandardCharsets.UTF_8
                        )
                );
            }

            int responseCode =
                    connection.getResponseCode();

            String response =
                    readResponse(connection);

            if (responseCode == 200) {

                logger.info(
                        "Successfully claimed N7-Link reward for {}.",
                        player.getUsername()
                );

            } else if (responseCode == 409) {

                logger.info(
                        "N7-Link reward was already claimed for {}.",
                        player.getUsername()
                );

            } else {

                logger.warn(
                        "Reward claim API returned HTTP {} for {}: {}",
                        responseCode,
                        player.getUsername(),
                        response
                );
            }

        } catch (Exception error) {

            logger.warn(
                    "Could not claim N7-Link reward for {}: {}",
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
    // GENERATE LINK CODE
    // =====================================================

    private String generateCode() {

        final String characters =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        StringBuilder code =
                new StringBuilder(codeLength);

        for (int i = 0; i < codeLength; i++) {

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
    // READ HTTP RESPONSE
    // =====================================================

    private String readResponse(
            HttpURLConnection connection
    ) throws Exception {

        InputStream input;

        if (
                connection.getResponseCode() >= 400
        ) {

            input =
                    connection.getErrorStream();

        } else {

            input =
                    connection.getInputStream();
        }

        if (input == null) {
            return "";
        }

        try (
                Scanner scanner =
                        new Scanner(
                                input,
                                StandardCharsets.UTF_8
                        )
        ) {

            scanner.useDelimiter(
                    "\\A"
            );

            return scanner.hasNext()
                    ? scanner.next()
                    : "";
        }
    }


    // =====================================================
    // EXTRACT JSON VALUE
    // =====================================================

    private String extractJsonValue(
            String json,
            String key
    ) {

        if (json == null || json.isBlank()) {
            return null;
        }

        String search =
                "\"" + key + "\"";

        int keyIndex =
                json.indexOf(search);

        if (keyIndex == -1) {
            return null;
        }

        int colonIndex =
                json.indexOf(
                        ":",
                        keyIndex + search.length()
                );

        if (colonIndex == -1) {
            return null;
        }

        int start =
                colonIndex + 1;

        while (
                start < json.length()
                        && Character.isWhitespace(
                                json.charAt(start)
                        )
        ) {
            start++;
        }

        if (
                start >= json.length()
                        || json.charAt(start) != '"'
        ) {
            return null;
        }

        start++;

        StringBuilder value =
                new StringBuilder();

        boolean escaped = false;

        for (
                int i = start;
                i < json.length();
                i++
        ) {

            char character =
                    json.charAt(i);

            if (escaped) {

                value.append(
                        character
                );

                escaped = false;

                continue;
            }

            if (character == '\\') {

                escaped = true;

                continue;
            }

            if (character == '"') {

                return value.toString();
            }

            value.append(
                    character
            );
        }

        return null;
    }


    // =====================================================
    // ESCAPE JSON
    // =====================================================

    private String escapeJson(
            String value
    ) {

        if (value == null) {
            return "";
        }

        return value
                .replace(
                        "\\",
                        "\\\\"
                )
                .replace(
                        "\"",
                        "\\\""
                )
                .replace(
                        "\n",
                        "\\n"
                )
                .replace(
                        "\r",
                        "\\r"
                )
                .replace(
                        "\t",
                        "\\t"
                );
    }


    // =====================================================
    // LINK STATUS
    // =====================================================

    private static final class LinkStatus {

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
