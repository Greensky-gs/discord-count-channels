import { Guild, CategoryChannel } from 'discord.js';

/**
 * Counter channels names types.
 *
 * This is the types of counters you can set
 */
export type counterType = 'bots' | 'humans' | 'all';

/**
 * count channel types
 *
 * This is the counter channels types you can use to set a counter
 */
export type countChannelType = 'voice' | 'text' | 'stage';

/**
 * Configs for the manager
 */
export type configsType = {
    /**
     * Default channel type to all counters
     */
    defaultChannelType?: countChannelType;
    /**
     * Default voice joinable to all counters
     */
    defaultChannelJoinableIfVoice?: boolean;
    /**
     * Default channel names to all counters
     *
     * @var Use {count} to set the number in the name
     */
    defaultChannelNames?: Record<counterType | 'category', string>;
    /**
     * Default counters channel order to all servers
     */
    defaultChannelOrders?: counterType[];
    /**
     * Default channel enabled values to all servers
     */
    defaultChannelEnabled?: Record<counterType, boolean>;
    /**
     * Default locale for all servers
     *
     * @warning Locales are two characters long
     * @examples Use `fr`, `en`, `us`, `de` ...
     */
    defaultLocale?: string;
};
export type databaseTable = {
    /**
     * Guild ID
     */
    guild_id: string;
    /**
     * Enabled values
     */
    enabled: string;
    /**
     * All counter channel ID
     */
    all_chan: string;
    /**
     * Human counter channel ID
     */
    humans: string;
    /**
     * Bots counter channel ID
     */
    bots: string;
    /**
     * Counters category's ID
     */
    category: string;
    /**
     * All counter name
     */
    all_name: string;
    /**
     * Bots counter name
     */
    bots_name: string;
    /**
     * Humans counter name
     */
    humans_name: string;
    /**
     * Locale value
     * @examples `fr`, `en`
     */
    locale: string;
    /**
     * Counters channels type
     */
    channelType: countChannelType;
};

/**
 * Options for the method `createCounters()`
 */
export type createCountersType<T extends countChannelType = countChannelType> = {
    /**
     * Guild to set the counters
     */
    guild: Guild;
    /**
     * Enable counters states
     */
    enable?: {
        /**
         * All counter enabled
         */
        all?: boolean;
        /**
         * Bots counter enabled
         */
        bots?: boolean;
        /**
         * Humans counter enabled
         */
        humans?: boolean;
    };
    /**
     * Counter names
     *
     * @var Use {count} to set the number in the counter
     */
    names?: {
        /**
         * All counter name
         */
        all?: string;
        /**
         * Bots counter name
         */
        bots?: string;
        /**
         * Humans counter name
         */
        humans?: string;
        /**
         * Counters category name
         */
        category?: string;
    };
    /**
     * Category channel to set the counter in
     *
     * If not provided, category is created
     */
    category?: CategoryChannel;
    /**
     * Counters channel type
     */
    channelsType?: T;
    /**
     * Counters channel order
     */
    order?: counterType[];
    /**
     * Counters language
     *
     * @warning Locales are two letters long
     * @examples Use for example `fr`, `en`, `us`, `de` ...
     */
    locale?: string;
    /**
     * Wether if voice channels are joinable, in case of the counters are voice type
     */
    voiceJoinable?: T extends 'voice' ? boolean : null;
};
