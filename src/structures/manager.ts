import { ChannelType, Client, Collection, OverwriteData } from 'discord.js';
import { Connection } from 'mysql';
import {
    channelCounterTypes,
    configsType,
    countChannelType,
    createCountersType,
    databaseTable
} from '../typings/typings';
import { getValidChannelOrder } from '../utils/functions';

export class Counter {
    public readonly client: Client;
    public readonly database: Connection;
    public readonly configs: configsType;
    private _cache: Collection<string, databaseTable> = new Collection();

    constructor(client: Client, database: Connection, configs?: configsType) {
        this.client = client;
        this.database = database;

        this.configs = {
            defaultChannelType: configs?.defaultChannelType ?? 'voice',
            defaultChannelJoinableIfVoice: configs?.defaultChannelJoinableIfVoice ?? false,
            defaultChannelNames: configs?.defaultChannelNames ?? {
                all: 'All: {count}',
                bots: 'Bots: {count}',
                humans: 'Humans: {count}',
                category: '📊 Stats'
            },
            defaultChannelOrders: getValidChannelOrder(configs?.defaultChannelOrders),
            defaultChannelEnabled: {
                all: configs?.defaultChannelEnabled?.all ?? true,
                bots: configs?.defaultChannelEnabled?.bots ?? true,
                humans: configs?.defaultChannelEnabled?.humans ?? true
            },
            defaultLocale: (configs?.defaultLocale ?? 'en').length > 2 ? 'en' : configs?.defaultLocale ?? 'en'
        };
    }
    public query<T = any>(sql: string): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            this.database.query(sql, (error, request) => {
                if (error) return reject(error);
                resolve(request);
            });
        });
    }
    public async start() {
        await this.query(`CREATE TABLE IF NOT EXISTS counters (
            guild_id TEXT(255) NOT NULL PRIMARY KEY,
            enabled TEXT(3) NOT NULL DEFAULT '${this.generateEnableList()}',
            all_chan VARCHAR(255) DEFAULT NULL,
            humans VARCHAR(255) DEFAULT NULL,
            bots VARCHAR(255) DEFAULT NULL,
            category VARCHAR(255) NOT NULL,
            all_name VARCHAR(255) DEFAULT NULL,
            bots_name VARCHAR(255) DEFAULT NULL,
            humans_name VARCHAR(255) DEFAULT NULL,
            locale VARCHAR(2) NOT NULL DEFAULT '${this.configs.defaultLocale}'
        )`);

        await this.fillCache();
        this.setEvent();
        this.syncCounters();
    }
    public getEnabled({ guild_id, type }: { guild_id: string; type: channelCounterTypes }) {
        const mapping: Record<channelCounterTypes, number> = {
            all: 0,
            bots: 1,
            humans: 2
        };
        const enabledList = this._cache.get(guild_id)?.enabled;
        if (!enabledList) return this.configs.defaultChannelEnabled[type];

        return enabledList[mapping[type]] === 't' ? true : false;
    }
    private setEnabled({
        type,
        state,
        guild_id
    }: {
        type: channelCounterTypes;
        state: boolean;
        guild_id: string;
    }): Promise<databaseTable> {
        return new Promise(async (resolve) => {
            let list = this._cache.get(guild_id).enabled;

            const mapping: Record<channelCounterTypes, number> = {
                all: 0,
                bots: 1,
                humans: 2
            };
            const arr = [...list];

            arr[mapping[type]] = state ? 't' : 'f';
            list = arr.join('');

            this._cache.set(guild_id, {
                ...this._cache.get(guild_id),
                enabled: list
            });

            await this.query(`UPDATE counters SET enabled='${list}' WHERE guild_id='${guild_id}'`);
            resolve(this.cache.get(guild_id));
        });
    }
    private generateEnableList(configs?: { all?: boolean; humans?: boolean; bots?: boolean }) {
        const toStr = (bool: boolean) => (bool ? 't' : 'f');
        if (configs) {
            let str = '';
            for (const x of ['all', 'bots', 'humans'] as channelCounterTypes[]) {
                str += toStr(configs[x] ?? this.configs.defaultChannelEnabled[x]);
            }
            return str;
        }
        return (
            toStr(this.configs.defaultChannelEnabled.all) +
            toStr(this.configs.defaultChannelEnabled.bots) +
            toStr(this.configs.defaultChannelEnabled.humans)
        );
    }
    private fillCache(): Promise<void> {
        return new Promise(async (resolve) => {
            const datas = await this.query<databaseTable>(`SELECT * FROM counters`);

            for (const data of datas) {
                this._cache.set(data.guild_id, data);
            }

            resolve();
        });
    }
    private updateCounters(guild_id: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            const { all_chan, bots, humans, channelType } = this._cache.get(guild_id);
            const guild = this.client.guilds.cache.get(guild_id);

            if (!guild) return reject('Guild not found');

            const promises = [];
            await guild.members.fetch();

            const ids: Record<channelCounterTypes, string> = {
                all: '',
                bots: '',
                humans: ''
            };

            if (this.getEnabled({ guild_id, type: 'all' })) {
                const channel =
                    (await guild.channels.fetch(all_chan)) ??
                    (await guild.channels.create({
                        name: this.resolveChannelName({
                            guild_id,
                            channel: 'all',
                            int: guild.memberCount
                        }),
                        type: this.getChannelType(channelType)
                    }));

                if (channel)
                    promises.push(
                        channel.setName(
                            this.resolveChannelName({
                                guild_id,
                                channel: 'all',
                                int: 0
                            })
                        )
                    );
                ids.all = channel.id;
            }
            if (this.getEnabled({ guild_id, type: 'bots' })) {
                const channel =
                    (await guild.channels.fetch(bots)) ??
                    (await guild.channels.create({
                        name: this.resolveChannelName({
                            guild_id,
                            channel: 'bots',
                            int: 0
                        }),
                        type: this.getChannelType(channelType)
                    }));

                if (channel)
                    promises.push(
                        channel.setName(
                            this.resolveChannelName({
                                guild_id,
                                channel: 'bots',
                                int: guild.members.cache.filter((x) => x.user.bot).size
                            })
                        )
                    );
                ids.bots = channel.id;
            }
            if (this.getEnabled({ guild_id, type: 'humans' })) {
                const channel =
                    (await guild.channels.fetch(humans)) ??
                    (await guild.channels.create({
                        name: this.resolveChannelName({
                            guild_id,
                            channel: 'humans',
                            int: 0
                        }),
                        type: this.getChannelType(channelType)
                    }));
                if (channel)
                    promises.push(
                        channel.setName(
                            this.resolveChannelName({
                                guild_id,
                                channel: 'humans',
                                int: guild.members.cache.filter((x) => !x.user.bot).size
                            })
                        )
                    );
                ids.humans = channel.id;
            }

            this.cache.set(guild_id, {
                ...this.cache.get(guild_id),
                all_chan: ids.all,
                humans: ids.humans,
                bots: ids.bots
            });

            await Promise.all([
                ...promises,
                this.query(
                    `UPDATE counters SET all_chan='${ids.all}', bots='${ids.bots}', humans='${ids.humans}' WHERE guild_id='${guild_id}'`
                )
            ]);
            resolve();
        });
    }
    private resolveChannelName({
        guild_id,
        channel,
        int
    }: {
        guild_id: string;
        channel: channelCounterTypes;
        int: number;
    }) {
        const x: Record<string, 'all_chan' | 'bots' | 'humans'> = {
            all: 'all_chan',
            bots: 'bots',
            humans: 'humans'
        };
        return this._cache
            .get(guild_id)
            [x[channel]].replace(/\{count\}/g, int.toLocaleString(this._cache.get(guild_id).locale));
    }
    public createCounters({
        guild,
        category,
        enable = {},
        names = {},
        channelsType = this.configs.defaultChannelType,
        order,
        locale = this.configs.defaultLocale,
        voiceJoinable = true
    }: createCountersType): Promise<databaseTable> {
        order = getValidChannelOrder(order);

        (['all', 'bots', 'humans'] as channelCounterTypes[]).forEach((x) => {
            names[x] = names[x] ?? this.configs.defaultChannelNames[x];
            enable[x] = enable[x] ?? this.configs.defaultChannelEnabled[x];
        });

        return new Promise(async (resolve, reject) => {
            if (this._cache.has(guild.id)) return reject('Guild already registered');

            const permissionOverwrites: OverwriteData[] = [
                Object.assign(
                    {
                        id: guild.id
                    },
                    voiceJoinable ? { allow: ['Connect'] } : ({ deny: ['Connect'] } as any)
                )
            ];

            if (!category) {
                category = await guild.channels.create({
                    name: names.category ?? this.configs.defaultChannelNames.category,
                    type: ChannelType.GuildCategory,
                    position: 1,
                    permissionOverwrites
                });
            }

            const type = this.getChannelType(channelsType);
            const chans: Record<string, Record<'id', undefined>> = {
                all: { id: undefined },
                bots: { id: undefined },
                humans: { id: undefined }
            };

            for (const orderData of order) {
                if (enable[orderData])
                    chans[orderData] = await guild.channels.create({
                        name: names[orderData],
                        type,
                        parent: category,
                        permissionOverwrites
                    });
                if (enable[orderData])
                    chans[orderData] = await guild.channels.create({
                        name: names[orderData],
                        type,
                        parent: category,
                        permissionOverwrites
                    });
                if (enable[orderData])
                    chans[orderData] = await guild.channels.create({
                        name: names[orderData],
                        type,
                        parent: category,
                        permissionOverwrites
                    });
            }

            const data = {
                enabled: this.generateEnableList(enable),
                all_chan: chans?.all?.id ?? '',
                all_name: names.all,
                guild_id: guild.id,
                bots: chans?.bots?.id ?? '',
                bots_name: names.bots,
                humans: chans?.humans?.id ?? '',
                humans_name: names?.humans,
                category: category.id,
                locale: locale,
                channelType: channelsType
            };
            this._cache.set(guild.id, data);

            await this.updateCounters(guild.id);
            await this.query(
                `INSERT INTO counters (guild_id, enabled, all_chan, humans, bots, category, all_name, botss_name, humans_name, locale, channelType) VALUES ("${
                    guild.id
                }", "${this.generateEnableList(enable)}", "${chans?.all?.id ?? ''}", "${chans?.humans?.id ?? ''}", "${
                    chans?.bots?.id ?? ''
                }", "${category.id}", "${this.getVar(names?.all) ?? ''}", "${this.getVar(names?.bots) ?? ''}", "${
                    this.getVar(names?.humans) ?? ''
                }", "${locale}", "${channelsType ?? this.configs?.defaultChannelType}" )`
            );

            return resolve(data);
        });
    }
    public removeGuildCounter({
        guild_id,
        deleteChannels
    }: {
        guild_id: string;
        deleteChannels: boolean;
    }): Promise<databaseTable> {
        return new Promise(async (resolve, reject) => {
            if (!this._cache.has(guild_id)) return reject('Guild not exists in cache');
            const data = this._cache.get(guild_id);

            if (deleteChannels) {
                const guild = await this.client.guilds.fetch(data.guild_id).catch(() => {});
                if (!guild) return resolve(data);

                for (const id of [data.all_chan, data.bots, data.humans, data.category]) {
                    const chan = await guild.channels.fetch(id).catch(() => {});
                    if (chan) await chan.delete().catch(() => {});
                }
            }
            await this.query(`DELETE FROM counters WHERE guild_id="${guild_id}"`);
            resolve(data);
        });
    }
    public get cache() {
        return this._cache;
    }
    private getVar(str: string) {
        if (!str) return str;
        return str.replace(/"/g, '\\"');
    }
    public updateCounterEnable({
        guild_id,
        counter,
        state = true
    }: {
        guild_id: string;
        counter: channelCounterTypes;
        state?: boolean;
    }): Promise<databaseTable> {
        return new Promise(async (resolve, reject) => {
            if (!this.cache.has(guild_id)) return reject('Guild not registered');

            await this.setEnabled({
                type: counter,
                guild_id,
                state
            });
            await this.updateCounters(guild_id);
            return resolve(this.cache.get(guild_id));
        });
    }
    public getChannelType(inp: countChannelType): any {
        const obj = {
            voice: ChannelType.GuildVoice,
            text: ChannelType.GuildText,
            stage: ChannelType.GuildStageVoice
        };
        return obj[inp];
    }
    private setEvent() {
        this.client.on('guildMemberAdd', (member) => {
            if (this._cache.has(member.guild.id)) this.updateCounters(member.guild.id);
        });
        this.client.on('guildMemberRemove', (member) => {
            if (this._cache.has(member.guild.id)) this.updateCounters(member.guild.id);
        });
    }
    private async syncCounters() {
        await this.client.guilds.fetch().catch(() => {});
        this.client.guilds.cache.forEach((guild) => {
            this.updateCounters(guild.id);
        });
    }
}
