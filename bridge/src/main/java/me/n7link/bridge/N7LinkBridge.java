package me.n7link.bridge;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.nio.charset.StandardCharsets;

public class N7LinkBridge extends JavaPlugin {

    private static final String CHANNEL = "n7link:reward";

    @Override
    public void onEnable() {

        getServer().getMessenger().registerIncomingPluginChannel(
                this,
                CHANNEL,
                (channel, player, message) -> {

                    if (!CHANNEL.equals(channel)) {
                        return;
                    }

                    handleReward(player, message);
                }
        );

        getLogger().info("N7-Link Bridge has been enabled!");
    }

    @Override
    public void onDisable() {

        getServer().getMessenger()
                .unregisterIncomingPluginChannel(
                        this,
                        CHANNEL
                );
    }

    private void handleReward(
            Player player,
            byte[] data
    ) {

        try {

            DataInputStream input =
                    new DataInputStream(
                            new ByteArrayInputStream(data)
                    );

            String header =
                    input.readUTF();

            if (!"N7LINK_REWARD_V1".equals(header)) {
                getLogger().warning(
                        "Received invalid N7-Link reward message."
                );
                return;
            }

            String minecraftUuid =
                    input.readUTF();

            String minecraftUsername =
                    input.readUTF();

            int commandCount =
                    input.readInt();

            if (commandCount < 0 || commandCount > 50) {
                getLogger().warning(
                        "Invalid reward command count."
                );
                return;
            }

            String[] commands =
                    new String[commandCount];

            for (int i = 0; i < commandCount; i++) {

                commands[i] =
                        input.readUTF();
            }

            String message =
                    input.readUTF();

            if (
                    !player.getUniqueId()
                            .toString()
                            .equals(minecraftUuid)
            ) {

                getLogger().warning(
                        "Reward UUID does not match player."
                );

                return;
            }

            for (String command : commands) {

                String finalCommand =
                        command
                                .replace(
                                        "%player%",
                                        minecraftUsername
                                )
                                .replace(
                                        "%uuid%",
                                        minecraftUuid
                                );

                Bukkit.dispatchCommand(
                        Bukkit.getConsoleSender(),
                        finalCommand
                );
            }

            if (
                    message != null &&
                    !message.isBlank()
            ) {

                player.sendMessage(
                        ChatColor.translateAlternateColorCodes(
                                '&',
                                message
                        )
                );
            }

            getLogger().info(
                    "N7-Link reward executed for "
                            + minecraftUsername
            );

        } catch (Exception error) {

            getLogger().warning(
                    "Could not process N7-Link reward: "
                            + error.getMessage()
            );
        }
    }
}
