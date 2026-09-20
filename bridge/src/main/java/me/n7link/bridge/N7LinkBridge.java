package me.n7link.bridge;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.plugin.messaging.PluginMessageListener;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;

public class N7LinkBridge extends JavaPlugin
        implements PluginMessageListener {

    private static final String REWARD_CHANNEL =
            "n7link:reward";

    private static final String ACK_CHANNEL =
            "n7link:reward_ack";

    @Override
    public void onEnable() {

        getServer().getMessenger()
                .registerIncomingPluginChannel(
                        this,
                        REWARD_CHANNEL,
                        this
                );

        getServer().getMessenger()
                .registerOutgoingPluginChannel(
                        this,
                        ACK_CHANNEL
                );

        getLogger().info(
                "N7-Link Bridge has been enabled!"
        );

        getLogger().info(
                "Reward channel registered."
        );

        getLogger().info(
                "Reward ACK channel registered."
        );
    }

    @Override
    public void onDisable() {

        getServer().getMessenger()
                .unregisterIncomingPluginChannel(
                        this,
                        REWARD_CHANNEL,
                        this
                );

        getServer().getMessenger()
                .unregisterOutgoingPluginChannel(
                        this,
                        ACK_CHANNEL
                );

        getLogger().info(
                "N7-Link Bridge has been disabled!"
        );
    }

    @Override
    public void onPluginMessageReceived(
            String channel,
            Player sender,
            byte[] message
    ) {

        if (!REWARD_CHANNEL.equals(channel)) {
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

                getLogger().warning(
                        "Unknown N7-Link packet: " + action
                );

                return;
            }

            String uuid =
                    input.readUTF();

            String username =
                    input.readUTF();

            int commandCount =
                    input.readInt();

            if (
                    commandCount < 0 ||
                    commandCount > 100
            ) {

                getLogger().warning(
                        "Invalid reward command count: "
                                + commandCount
                );

                return;
            }

            String[] commands =
                    new String[commandCount];

            for (
                    int i = 0;
                    i < commandCount;
                    i++
            ) {

                commands[i] =
                        input.readUTF();
            }

            String rewardMessage =
                    input.readUTF();

            Player target =
                    Bukkit.getPlayerExact(username);

            if (target == null) {

                getLogger().warning(
                        "Could not find player "
                                + username
                                + " for N7-Link reward."
                );

                return;
            }

            if (
                    !target.getUniqueId()
                            .toString()
                            .equalsIgnoreCase(uuid)
            ) {

                getLogger().warning(
                        "UUID mismatch for reward player "
                                + username
                );

                return;
            }

            Bukkit.getScheduler().runTask(
                    this,
                    () -> executeReward(
                            target,
                            uuid,
                            commands,
                            rewardMessage
                    )
            );

        } catch (Exception error) {

            getLogger().warning(
                    "Failed to process N7-Link reward: "
                            + error.getMessage()
            );
        }
    }

    private void executeReward(
            Player player,
            String uuid,
            String[] commands,
            String rewardMessage
    ) {

        if (
                player == null ||
                !player.isOnline()
        ) {
            return;
        }

        boolean executionStarted = true;

        for (String command : commands) {

            if (
                    command == null ||
                    command.isBlank()
            ) {
                continue;
            }

            String processedCommand =
                    command
                            .replace(
                                    "%player%",
                                    player.getName()
                            )
                            .replace(
                                    "%uuid%",
                                    uuid
                            );

            try {

                Bukkit.dispatchCommand(
                        Bukkit.getConsoleSender(),
                        processedCommand
                );

            } catch (Exception error) {

                executionStarted = false;

                getLogger().warning(
                        "Failed to execute reward command for "
                                + player.getName()
                                + ": "
                                + error.getMessage()
                );
            }
        }

        if (
                rewardMessage != null &&
                !rewardMessage.isBlank()
        ) {

            String message =
                    ChatColor.translateAlternateColorCodes(
                            '&',
                            rewardMessage
                                    .replace(
                                            "%player%",
                                            player.getName()
                                    )
                                    .replace(
                                            "%uuid%",
                                            uuid
                                    )
                    );

            player.sendMessage(message);
        }

        if (executionStarted) {

            getLogger().info(
                    "Executed N7-Link rewards for "
                            + player.getName()
            );

            sendRewardAck(
                    player,
                    uuid
            );

        } else {

            getLogger().warning(
                    "N7-Link reward execution had errors for "
                            + player.getName()
                            + ". ACK will not be sent."
            );
        }
    }

    private void sendRewardAck(
            Player player,
            String uuid
    ) {

        try {

            ByteArrayOutputStream byteOutput =
                    new ByteArrayOutputStream();

            DataOutputStream output =
                    new DataOutputStream(
                            byteOutput
                    );

            output.writeUTF(
                    "N7LINK_REWARD_ACK_V1"
            );

            output.writeUTF(uuid);

            output.flush();

            player.sendPluginMessage(
                    this,
                    ACK_CHANNEL,
                    byteOutput.toByteArray()
            );

            getLogger().info(
                    "Sent reward ACK for "
                            + player.getName()
            );

        } catch (Exception error) {

            getLogger().warning(
                    "Could not send reward ACK for "
                            + player.getName()
                            + ": "
                            + error.getMessage()
            );
        }
    }
}