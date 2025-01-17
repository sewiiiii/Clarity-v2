import { Client, Collection } from 'discord.js';
import fs from 'fs';

import translate from '@plainheart/google-translate-api';
import pgp from 'pg-promise';
import { Player } from 'discord-player';

import config from '../../../config/config.js';
import creators from '../../../config/creators.js';
import version from '../../../version.js';
import functions from '../utils/index.js';
import ms from '../utils/ms/index.js';
import emojis from '../../../config/emoji.js';
import pretty from 'pretty-ms';
import logsType from './logsType.js';
import channelType from './channelType.js';
import componentType from './componentType.js';
import buttonType from './buttonType.js';
import colorListed from './colorListed.js';
import ClarityDB from "clarity-db";
import { QuickDB } from 'quick.db';
import mongoose from 'mongoose';

export default class Clarity extends Client {
    constructor(options = {
        intents: [3276799],
        partials: [
            1, 2, 5, 3,
            4, 6, 0
        ],
    }) {
        super(options)
        this.setMaxListeners(0)
        this.commands = new Collection()
        this.aliases = new Collection()
        this.slashCommands = new Collection()
        this.snipes = new Collection()
        this.config = config
        this.creators = creators
        this.version = version
        this.player = Player.singleton(this);
        this.player.extractors.loadDefault();
        this.functions = functions
        this.ms = ms
        this.data = new ClarityDB(`./Clarity.json`, {
            backup: {
                enabled: true,
                folder: "./db_backups/",
                interval: 3600000,
            },
            preset: {
                hello: "world",
            },
        });
        this.data2 = new QuickDB();
        this.emoji = emojis
        this.db = pgp()(config.database.PostgreSQL)
        this.pretty = pretty
        this.logsType = logsType
        this.channelType = channelType
        this.componentType = componentType
        this.buttonType = buttonType
        this.colorListed = colorListed
        this.color = this.config.default_color;
        this.allInvites = new Collection();
        this.vanityCount = new Collection();
        this.translate = translate
        this.initCommands()
        this.initEvents()
        this.connectToToken()
        this.initMongo();
        // this.initSlashCommands();
    }

    async connectToToken() {
        this.login(this.config.token).then(() => {
            var x = setInterval(() => {
                if (this.ws.reconnecting || this.ws.destroyed) {
                    this.login(this.config.token).catch(e => {
                        clearInterval(x)
                        console.error("Erreur pendant la connexion au token :");
                        console.error(e);
                    })
                }
            }, 30000)
        }).catch(e => {
            console.error(e)
            if (e?.code?.toLowerCase()?.includes("token")) return;
            setTimeout(() => {
                this.connectToToken()
            }, 10000)
        })
    }

    async refreshConfig() {
        delete this.config;

        const currentModuleUrl = import.meta.url;
        this.config = await import(`${currentModuleUrl}../../../config/config.js`);
    };

    async initCommands() {
        const subFolders = fs.readdirSync('./source/commands');
        for (const category of subFolders) {
            const commandsFiles = fs.readdirSync(`./source/commands/${category}`).filter(file => file.endsWith('.js'));
            for (const commandFile of commandsFiles) {

                const command = await import(`../../commands/${category}/${commandFile}`);
                var cmd = command.default;

                cmd.category = category
                cmd.commandFile = commandFile
                if (cmd.name === "bl" && this.config.isPublic) continue;
                if (cmd.name === "unbl" && this.config.isPublic) continue;
                if (cmd.name === "leavesettings") continue;
                if (cmd.category === 'gestion' && this.config.isPublic) continue;
                this.commands.set(cmd.name, cmd);
                if (cmd.aliases && cmd.aliases.length > 0) {
                    cmd.aliases.forEach(alias => this.aliases.set(alias, cmd));
                }
            }
        }
        let finale = new Collection();
        this.commands.map(cmd => {
            if (finale.has(cmd.name)) return;
            finale.set(cmd.name, cmd);
            this.commands.filter(v => v.name.startsWith(cmd.name) || v.name.endsWith(cmd.name)).map(cm => finale.set(cm.name, cm));
        })
        this.commands = finale;
    };

    async initMongo() {
        this.mongo = await mongoose
            .connect(
                config.database.MongoDB,
                {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                }
            )
            .then(() => {
                console.log("[MongoDB] Connected");
            })
            .catch((e) => {
                console.error("[MongoDB] Error");
                console.error(e);
            });
    };

    async initEvents() {
        const subFolders = fs.readdirSync(`./source/events`)
        for (const category of subFolders) {
            const eventsFiles = fs.readdirSync(`./source/events/${category}`).filter(file => file.endsWith(".js"))
            for (const eventFile of eventsFiles) {
                await import(`../../events/${category}/${eventFile}`).then((data) => {
                    if (data.default) {
                        this.on(data.default.name, (...args) => data.default.run(this, ...args))
                        if (category === 'anticrash') process.on(data.default.name, (...args) => data.default.run(this, ...args));
                    }
                });
            }
        }
    }


    async initSlashCommands() {
        const subFolders = fs.readdirSync(`./source/slashCmds`)
        for (const category of subFolders) {
            const commandsFiles = fs.readdirSync(`./source/slashCmds/${category}`).filter(file => file.endsWith('.js'))
            for (const commandFile of commandsFiles) {
                const command = await import(`../../slashCmds/${category}/${commandFile}`).default;
                command.category = category
                command.commandFile = commandFile
                this.slashCommands.set(command.name, command)
            }
        }
    }
}