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

        const memoryNotes: string[] = []
        const bandsList: { source: string, target: string }[] = []

        for (const path in LINKS) {
            if (path.startsWith("7 - Agent Memory/")) {
                memoryNotes.push(path)
            }

            for (const band in LINKS[path]) {
                bandsList.push({ source: path, target: band })
            }
        }
    }
}