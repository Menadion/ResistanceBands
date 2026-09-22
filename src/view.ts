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
        const APP_SETTINGS = await this.app.vault.adapter.read(APP)
        const FILTERS = (JSON.parse(APP_SETTINGS) as { userIgnoreFilters?: string[] })["userIgnoreFilters"] ?? []

        const GRAPH = this.app.vault.configDir + "/graph.json"
        const GRAPH_SETTINGS = await this.app.vault.adapter.read(GRAPH)
        const DISTANCE = (JSON.parse(GRAPH_SETTINGS) as { linkDistance?: number })["linkDistance"] ?? 30
        
        const BAND_RULES: { folder: string, multiplier: number, rank: number}[] = [
            { folder: "7 - Agent Memory/",  multiplier: 3, rank: 1 },
            { folder: "3 - Tags/",  multiplier: 0.5, rank: 2 }
        ]

        const bandsList: { source: string, target: string, length: number }[] = []

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

                let bandMultiplier = 1

                if (sourceRule && targetRule) {
                    if (sourceRule.rank < targetRule.rank) {
                        bandMultiplier = sourceRule.multiplier
                    } else if (sourceRule.rank > targetRule.rank) {
                        bandMultiplier = targetRule.multiplier
                    } else {
                        bandMultiplier = (sourceRule.multiplier + targetRule.multiplier) / 2
                    } 
                } else if (sourceRule) {
                    bandMultiplier = sourceRule.multiplier
                } else if (targetRule) {
                    bandMultiplier = targetRule.multiplier
                }

                bandsList.push({ source: path, target: band, length: (DISTANCE * bandMultiplier) })
            }
        }
    }
}