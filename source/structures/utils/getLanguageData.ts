import { Client } from 'discord.js';
import yaml from 'js-yaml';
import fs from 'fs';

interface LangsData {
    [lang: string]: any
};

let LangsData: LangsData = {};

async function getLanguageData(client: Client, guildId: string) {
    let lang: string = await client.data2.get(`${guildId}_guildlang`) || 'fr-FR';

    let dat = LangsData[lang];

    if (!dat) {
        let fileContent = fs.readFileSync(`${process.cwd()}/source/lang/${lang}.yml`,
            'utf-8'
        );

        LangsData[lang] = yaml.load(fileContent) as any;
        dat = LangsData[lang]
    };

    return dat;
};

export default { getLanguageData };