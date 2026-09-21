import {
    ItemView 
} from 'obsidian';

export const VIEW_TYPE_RESBAND = "resistance-bands-view";

export class ResBandView extends ItemView {
    icon = 'waypoints' 

    getViewType() {return VIEW_TYPE_RESBAND}
    getDisplayText() {return "Rb graph"}

    async onOpen() {
        this.contentEl.empty()
        this.contentEl.createEl("h4", {text: "placeholder"})

        const LINKS = this.app.metadataCache.resolvedLinks
        const APP = this.app.vault.configDir + "/app.json"
        const SETTINGS = await this.app.vault.adapter.read(APP)
        const FILTERS = (JSON.parse(SETTINGS) as { userIgnoreFilters?: string[] })["userIgnoreFilters"] ?? []
        
        const BAND_RULES: { folder: string, length: number, rank: number}[] = [
            { folder: "7 - Agent Memory/",  length: 300, rank: 1 },
            { folder: "3 - Tags/",  length: 50, rank: 2 }
        ]

        const bandsList: { source: string, target: string }[] = []

        for (const path in LINKS) {
            if (FILTERS.some(filter => path.startsWith(filter))) {
                continue
            }

            const sourceRule = BAND_RULES.find(rule => path.startsWith(rule.folder))

            for (const band in LINKS[path]) {
                if (FILTERS.some(filter => band.startsWith(filter))) {
                    continue
                }
                
                const targetRule = BAND_RULES.find(rule => band.startsWith(rule.folder))

                bandsList.push({ source: path, target: band })
            }
        }
    }
}