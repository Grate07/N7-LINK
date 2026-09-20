package me.n7link.bridge;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;

public class N7LinkBridge extends JavaPlugin
        implements PluginMessageListener {

    private static final String CHANNEL = "n7link:reward";

    @Override
    public void onEnable() {

        getServer().getMessenger()
                .registerIncomingPluginChannel(
                        this,
                        CHANNEL,
                        this
                );

        getServer().getMessenger()
                .registerOutgoingPluginChannel(
                        this,
                        CHANNEL
                );

        getLogger().info(
                "N7-Link Bridge has been enabled!"
        );

        getLogger().info(
                "Reward channel registered."
        );
    }

    @Override
    public void onDisable() {

        getServer().getMessenger()
                .unregisterIncomingPluginChannel(
                        this,
                        CHANNEL,
                        this
                );

        getServer().getMessenger()
                .unregisterOutgoingPluginChannel(
                        this,
                        CHANNEL
                );

        getLogger().info(
                "N7-Link Bridge has been disabled!"
        );
    }

    @Override
    public void onPluginMessageReceived(
            String channel,
            Player player,
            byte[] message
    ) {

        if (!CHANNEL.equals(channel)) {
            return;
        }

        try {

            DataInputStream input =
                    new DataInputStream(
                            new ByteArrayInputStream(message)
                    );

            String action =
                    input.readUTF();

            if (!"N7LINK_REWARD_V1".equals(action)) {
                return;
            }

            String uuid =
                    input.readUTF();

            String username =
                    input.readUTF();

            int commandCount =
                    input.readInt();

            String[] commands =
                    new String[commandCount];

            for (int i = 0; i < commandCount; i++) {
                commands[i] = input.readUTF();
            }

            String rewardMessage =
                    input.readUTF();

            Player target =
                    Bukkit.getPlayerExact(username);

            if (target == null) {
                getLogger().warning(
                        "Could not find player "
                                + username
                                + " for reward."
                );
                return;
            }

            Bukkit.getScheduler().runTask(
                    this,
                    () -> {

                        for (String command : commands) {

                            if (command == null ||
                                    command.isBlank()) {
                                continue;
                            }

                            String processedCommand =
                                    command
                                            .replace(
                                                    "%player%",
                                                    target.getName()
                                            )
                                            .replace(
                                                    "%uuid%",
                                                    uuid
                                            );

                            Bukkit.dispatchCommand(
                                    Bukkit.getConsoleSender(),
                                    processedCommand
                            );
                        }

                        if (rewardMessage != null &&
                                !rewardMessage.isBlank()) {

                            String messageText =
                                    rewardMessage
                                            .replace(
                                                    "%player%",
                                                    target.getName()
                                            )
                                            .replace(
                                                    "%uuid%",
                                                    uuid
                                            )
                                            .replace(
                                                    "&",
                                                    "§"
                                            );

                            target.sendMessage(
                                    messageText
                            );
                        }

                        getLogger().info(
                                "Executed N7-Link rewards for "
                                        + target.getName()
                        );
                    }
            );

        } catch (Exception error) {

            getLogger().warning(
                    "Failed to process N7-Link reward: "
                            + error.getMessage()
            );
        }
    }
        }
