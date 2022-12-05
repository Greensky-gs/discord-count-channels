import { Guild, CategoryChannel } from 'discord.js';

export type channelCounterTypes = 'bots' | 'humans' | 'all';
export type countChannelType = 'voice' | 'text' | 'stage';

export type configsType = {
    defaultChannelType?: countChannelType;
    defaultChannelJoinableIfVoice?: boolean;
    /**
     * Use {count} to set the number in the name
     */
    defaultChannelNames?: Record<channelCounterTypes | 'category', string>;
    defaultChannelOrders?: channelCounterTypes[];
    defaultChannelEnabled?: Record<channelCounterTypes, boolean>;
    defaultLocale?: string;
};
export type databaseTable = {
    guild_id: string;
    enabled: string;
    all_chan: string;
    humans: string;
    bots: string;
    category: string;
    all_name: string;
    bots_name: string;
    humans_name: string;
    locale: string;
    channelType: countChannelType;
};

export type createCountersType<T extends countChannelType = countChannelType> = {
    guild: Guild;
    enable?: {
        all?: boolean;
        bots?: boolean;
        humans?: boolean;
    };
    /**
     * Use {count} to set the number in the counter
     */
    names?: {
        all?: string;
        bots?: string;
        humans?: string;
        category?: string;
    };
    /**
     * If not provided, category is created
     */
    category?: CategoryChannel;
    channelsType?: T;
    order?: channelCounterTypes[];
    locale?: string;
    voiceJoinable?: T extends 'voice' ? boolean : null
};