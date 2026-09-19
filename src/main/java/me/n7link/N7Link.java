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
                            "§7Use this code in the N7-Link Discord bot."
                    )
            );

            player.sendMessage(
                    Component.text(
                            "§7Example: §f/link code:" + code
                    )
            );

            player.sendMessage(
                    Component.text("")
            );

            player.sendMessage(
                    Component.text(
                            "§7The code expires after §f5 minutes§7."
                    )
            );

            player.sendMessage(
                    Component.text(
                            "§8§m----------------------------"
                    )
            );
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
}
