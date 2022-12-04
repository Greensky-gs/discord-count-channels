import { ChannelType, Client, Collection } from "discord.js";
import { Connection } from "mysql";
import { channelCounterTypes, configsType, countChannelType, createCountersType, databaseTable } from "../typings/typings";
import { getValidChannelOrder } from "../utils/functions";

export class Counter {
    public readonly client: Client;
    public readonly database: Connection;
    public readonly configs: configsType;
    private cache: Collection<string, databaseTable> = new Collection();

    constructor(client: Client, database: Connection, configs?: configsType) {
        this.client = client;
        this.database = database;

        this.configs = {
            defaultChannelType: configs?.defaultChannelType ?? 'voice',
            defaultChannelJoinableIfVoice: configs?.defaultChannelJoinableIfVoice ?? false,
            defaultChannelNames: configs?.defaultChannelNames ?? { all: 'All: {count}', bots: 'Bots: {count}', humans: 'Humans: {count}', category: '📊 Stats' },
            defaultChannelOrders: getValidChannelOrder(configs?.defaultChannelOrders),
            defaultChannelEnabled: {
                all: configs?.defaultChannelEnabled?.all ?? true,
                bots: configs?.defaultChannelEnabled?.bots ?? true,
                humans: configs?.defaultChannelEnabled?.humans ?? true
            }
        }
    }
    public query<T = any>(sql: string): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            this.database.query(sql, (error, request) => {
                if (error) return reject(error)
                resolve(request)
            })
        })
    }
    public async start() {
        await this.query(`CREATE TABLE IF NOT EXISTS counters (
            guild_id TEXT NOT NULL PRIMARY KEY,
            enabled TEXT(3) NOT NULL DEFAULT '${this.generateEnableList()}',
            all_chan VARCHAR(255) DEFAULT NULL,
            humans VARCHAR(255) DEFAULT NULL,
            bots VARCHAR(255) DEFAULT NULL,
            category VARCHAR(255) NOT NULL,
            all_name VARCHAR(255) DEFAULT NULL,
            bots_name VARCHAR(255) DEFAULT NULL,
            humans_name VARCHAR(255) DEFAULT NULL
        )`)

        this.fillCache();
    }
    public getEnabled({ guild_id, type }: { guild_id: string; type: channelCounterTypes; }) {
        const mapping: Record<channelCounterTypes, number> = {
            all: 0,
            bots: 1,
            humans: 2
        };
        const enabledList = this.cache.get(guild_id)?.enabled;
        if (!enabledList) return this.configs.defaultChannelEnabled[type];

        return enabledList[mapping[type]] === 't' ? true : false;
    }
    /**
     * @warning This method works only for cached datas
     */
    private setEnabled({ type, state, guild_id }: { type: channelCounterTypes; state: boolean; guild_id: string }) {
        let list = this.cache.get(guild_id).enabled;

        const mapping: Record<channelCounterTypes, number> = {
            all: 0,
            bots: 1,
            humans: 2
        };
        const arr = [...list];

        arr[mapping[type]] = state ? 't' : 'f';
        list = arr.join('');

        this.cache.set(guild_id, {
            ...this.cache.get(guild_id),
            enabled: list
        });
        this.query(`UPDATE counters SET enabled='${list}' WHERE guild_id='${guild_id}'`);
    }
    private generateEnableList() {
        const toStr = (bool: boolean) => bool ? 't' : 'f';
        return toStr(this.configs.defaultChannelEnabled.all) + toStr(this.configs.defaultChannelEnabled.bots) + toStr(this.configs.defaultChannelEnabled.humans);
    }
    private async fillCache() {
        const datas = await this.query<databaseTable>(`SELECT * FROM counters`);

        for (const data of datas) {
            this.cache.set(data.guild_id, data);
        }
    }
    public createCounters({ guild, category, enable = {}, names = {}, channelsType = this.configs.defaultChannelType, order }: createCountersType): Promise<databaseTable> {
        order = getValidChannelOrder(order);

        (['all', 'bots', 'humans'] as channelCounterTypes[]).forEach((x) => {
            names[x] = names[x] ?? this.configs.defaultChannelNames[x];
            enable[x] = enable[x] ?? this.configs.defaultChannelEnabled[x];
        });

        return new Promise(async(resolve, reject) => {
            if (!category) {
                category = await guild.channels.create({
                    name: names.category ?? this.configs.defaultChannelNames.category,
                    type: ChannelType.GuildCategory,
                    position: 1
                });
            }

            const type = this.getChannelType(channelsType);
            for (const orderData of order) {
                if (enable[orderData]) await guild.channels.create({
                    name: names[orderData],
                    type,
                    parent: category
                })
                if (enable[orderData]) await guild.channels.create({
                    name: names[orderData],
                    type,
                    parent: category
                })
                if (enable[orderData]) await guild.channels.create({
                    name: names[orderData]
                })

            }
        })
    }
    public getChannelType(inp: countChannelType): any {
        const obj = {
            voice: ChannelType.GuildVoice,
            text: ChannelType.GuildText,
            stage: ChannelType.GuildStageVoice
        };
        return obj[inp];
    }
}

const x: keyof typeof ChannelType = 'AnnouncementThread'