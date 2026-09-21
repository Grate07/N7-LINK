N7-Link

N7-Link is a free and open-source Minecraft ↔ Discord account linking system designed for modern Minecraft networks.

It allows players to link their Minecraft account with Discord, view their linked information, receive configurable rewards, and manage their connection between Minecraft and Discord.

N7-Link is designed around Velocity networks and uses a lightweight Paper bridge for server-side reward execution.

---

✨ Features

- 🔗 Minecraft ↔ Discord account linking
- ⚡ Velocity support
- 🧩 Paper bridge for backend servers
- 🌐 Java and Bedrock network support
- 🎟️ Temporary linking codes
- 👤 Discord profile information
- 🔎 Link information lookup
- 🔓 Account unlinking
- 🎭 Automatic Discord linked role
- 🎁 Configurable linking rewards
- 💰 Support for economy/currency commands
- 🔐 Permanent reward-claim protection
- 🔄 Configurable reward commands
- 🧩 "%player%" and "%uuid%" placeholders
- 🛡️ API authentication
- 💾 PostgreSQL database support
- 🤖 Discord bot integration
- 🆓 Free and open source

---

🌐 Network Structure

N7-Link is designed for a Velocity-based network.

                 ┌─────────────────┐
                 │     Discord     │
                 │    N7-Link Bot  │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │    N7-Link API  │
                 │   + PostgreSQL  │
                 └────────┬────────┘
                          │
                          │
Java Player ────────┐     │
                    ▼     │
              ┌───────────────┐
Bedrock ─────►│    Velocity   │
(Geyser)      │    N7-Link    │
              └───────┬───────┘
                      │
                      ▼
                ┌───────────┐
                │   Paper   │
                │   Bridge  │
                └───────────┘

The main N7-Link plugin runs on Velocity.

The Paper bridge handles operations that must be executed by the backend Minecraft server, such as reward commands.

---

📦 Components

N7-Link consists of several components:

Component| Purpose
"N7-Link"| Main Velocity plugin
"N7-Link-Bridge"| Paper backend bridge
"N7-Link API"| Linking and account data API
"N7-Link Bot"| Discord integration

---

⚙️ Requirements

Minecraft

- Velocity
- Paper 1.21.x
- Java 21

Network

For Bedrock support:

- Geyser
- Floodgate

Geyser/Floodgate can be installed according to your existing network setup.

Backend

- Node.js
- PostgreSQL
- Discord bot application

---

🚀 Installation

1. Install N7-Link on Velocity

Download the latest N7-Link release and place the plugin JAR in:

velocity/
└── plugins/
    └── n7-link-x.x.x.jar

Start Velocity once.

N7-Link will create its configuration file in:

plugins/n7link/config.yml

---

2. Configure the API

Open:

plugins/n7link/config.yml

Configure:

api:
  url: "https://your-api.example.com"
  secret: "YOUR_API_SECRET"

The API secret must match the secret configured on the N7-Link API.

---

3. Install the Paper Bridge

Download the N7-Link Bridge JAR and place it in the backend Paper server:

paper/
└── plugins/
    └── n7-link-bridge-x.x.x.jar

Restart the Paper server.

You should see:

N7-Link Bridge has been enabled!

Important

Do not install the main N7-Link Velocity plugin on Paper.

Do not install the Paper bridge on Velocity.

The two plugins have different purposes.

---

🎁 Reward System

N7-Link supports configurable rewards after a successful Discord link.

Example:

rewards:
  enabled: true

  commands:
    - "eco give %player% 10000"
    - "coins give %player% 500"
    - "points give %player% 100"

  message: "&aThanks for linking your Discord account!"

Commands are executed by the Paper bridge using the server console.

This means N7-Link can work with plugins such as:

- EssentialsX
- CoinsEngine
- PlayerPoints
- LuckPerms
- Other plugins that provide console commands

---

🏷️ Reward Placeholders

N7-Link supports:

%player%
%uuid%

Example:

commands:
  - "eco give %player% 10000"
  - "coins give %player% 500"
  - "points give %player% 100"

For a player named "Steve", the bridge will execute:

eco give Steve 10000
coins give Steve 500
points give Steve 100

---

🔐 Permanent Reward Protection

N7-Link prevents users from repeatedly receiving the linking reward.

Reward history is stored separately from the current account link.

Therefore:

Link
 ↓
Receive reward
 ↓
Unlink
 ↓
Link another Discord/Minecraft account
 ↓
Reward is NOT granted again

This prevents players from abusing "/unlink" and relinking to repeatedly claim rewards.

---

🔗 Linking Process

The basic linking flow is:

Player joins Minecraft
        ↓
/link
        ↓
N7-Link generates a temporary code
        ↓
Player opens Discord
        ↓
Discord /link
        ↓
Code is verified
        ↓
Minecraft + Discord accounts are linked
        ↓
Linked Discord role is assigned
        ↓
Rewards are processed

Linking codes expire after the configured amount of time.

Default:

link:
  code-length: 6
  code-expiry-minutes: 5

Example code:

23B567

---

🤖 Discord Bot

The N7-Link Discord bot provides the Discord-side linking interface.

Supported commands include:

/link
/profile
/linkinfo
/unlink
/setup-link

The bot communicates with the N7-Link API.

---

👤 "/profile"

Displays the user's linked Minecraft account.

Example information:

Minecraft
Username: PlayerName

Discord
Linked: Yes

Rewards
Claimed: Yes

---

🔎 "/linkinfo"

Displays information about the current Minecraft ↔ Discord connection.

---

🔓 "/unlink"

Removes the current Minecraft ↔ Discord connection.

Unlinking does not remove the permanent reward claim history.

---

🎭 Linked Discord Role

N7-Link can automatically assign a Discord role after successful linking.

Configure the role ID through the Discord bot environment variables.

The bot can also remove the linked role when an account is unlinked.

---

🗄️ Database

N7-Link uses PostgreSQL for account-link data.

The database stores information required for:

- Linking codes
- Minecraft accounts
- Discord accounts
- Link timestamps
- Reward status
- Permanent reward claims

The permanent reward history is intentionally stored separately so unlinking cannot reset reward eligibility.

---

🔐 Security

N7-Link uses an API secret to authenticate requests between its components.

Example:

Minecraft / Discord
        ↓
      API
        ↓
   PostgreSQL

Keep your API secret private.

Do not commit secrets to GitHub.

Recommended environment variables include:

DATABASE_URL
N7LINK_API_SECRET
DISCORD_TOKEN
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
N7LINK_API_URL
N7LINK_LINKED_ROLE_ID

---

🛠️ Building

N7-Link uses Maven.

From the repository root:

mvn clean package

The compiled Velocity plugin will be generated inside:

target/

The Paper bridge can be built from:

cd bridge
mvn clean package

The bridge JAR will be generated inside:

bridge/target/

---

📁 Project Structure

N7-Link/
│
├── pom.xml
│
├── src/
│   └── main/
│       ├── java/
│       │   └── me/
│       │       └── n7link/
│       │           └── N7Link.java
│       │
│       └── resources/
│           ├── velocity-plugin.json
│           └── config.yml
│
├── api/
│   ├── package.json
│   └── index.js
│
├── bot/
│   ├── package.json
│   └── index.js
│
└── bridge/
    ├── pom.xml
    │
    └── src/
        └── main/
            ├── java/
            │   └── me/
            │       └── n7link/
            │           └── bridge/
            │               └── N7LinkBridge.java
            │
            └── resources/
                └── plugin.yml

---

🔌 API

The API provides the communication layer between N7-Link components.

Main operations include:

POST /api/link/create
POST /api/link/verify
GET  /api/link/minecraft/:uuid
GET  /api/link/discord/:discordId
POST /api/link/minecraft/:uuid/reward-claim
POST /api/link/unlink

API requests are authenticated using the configured API secret.

---

🧪 Testing

Before deploying N7-Link to a production network, test:

- Creating a linking code
- Linking a Discord account
- Assigning the Discord role
- "/profile"
- "/linkinfo"
- "/unlink"
- Reward execution
- Reward protection
- Re-linking after unlink
- Expired linking codes
- Invalid linking codes
- Player reconnecting during the reward process

---

🐛 Troubleshooting

N7-Link doesn't start

Check:

Java version
Velocity version
plugins/n7link/config.yml
Velocity console

---

Rewards aren't being given

Check:

N7-Link Velocity plugin
N7-Link Bridge
Paper console
Reward commands

Make sure the commands work when executed directly from the Paper console.

For example:

eco give PlayerName 10000
coins give PlayerName 500
points give PlayerName 100

---

Discord role isn't assigned

Check:

DISCORD_TOKEN
N7LINK_LINKED_ROLE_ID
Discord bot permissions
Discord role hierarchy

The bot needs permission to manage the configured role.

---

🤝 Contributing

Contributions are welcome.

To contribute:

1. Fork the repository.
2. Create a new branch.
3. Make your changes.
4. Test your changes.
5. Open a Pull Request.

Bug reports and feature requests can be submitted through GitHub Issues.

---

📜 License

N7-Link is open-source software.

See the "LICENSE" file in this repository for the applicable license.

---

⭐ Support the Project

If N7-Link is useful to you:

- ⭐ Star the repository
- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Contribute improvements
- 📖 Improve the documentation

---

N7-Link

Minecraft ↔ Discord linking for modern Velocity networks.

Simple. Lightweight. Open source.