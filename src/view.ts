import {
    ItemView 
} from 'obsidian';

import {
    SimulationNodeDatum,
    SimulationLinkDatum,
    forceSimulation,
    forceLink,
    forceManyBody,
    forceX,
    forceY
} from 'd3-force'

interface RbNode extends SimulationNodeDatum {
    path: string
}

interface RbBand extends SimulationLinkDatum<RbNode> {
    source: RbNode | string,
    target: RbNode | string,
    length: number
}

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

        let PREFERENCES: { 
            linkDistance?: number, 
            repelStrength?: number, 
            centerStrength?: number, 
            linkStrength?: number, 
            showAttachments?: boolean 
        } = {}

        try {
            const GRAPH_SETTINGS = await this.app.vault.adapter.read(GRAPH)

            PREFERENCES = JSON.parse(GRAPH_SETTINGS) as { 
                linkDistance?: number, 
                repelStrength?: number, 
                centerStrength?: number, 
                linkStrength?: number, 
                showAttachments?: boolean 
            }
        } catch(error) {
            console.debug("Couldn't read graph.json, using default graph settings:", error)
        }

        // graph.json stores slider positions; Obsidian's graph converts them before use (app 1.13.7)
        const SLIDER_CURVE = (slider: number) => (Math.pow(0.01, 1 - slider) - 0.01) / (1 - 0.01)


        const DISTANCE = PREFERENCES["linkDistance"] ?? 250
        const REPEL = Math.max(Math.pow(PREFERENCES["repelStrength"] ?? 10, 3), 1)
        const CENTER = SLIDER_CURVE(PREFERENCES["centerStrength"] ?? 0.518713248970312)
        const LINK = SLIDER_CURVE(PREFERENCES["linkStrength"] ?? 1)
        const ATTACHMENTS_VISIBLE = PREFERENCES["showAttachments"] ?? true
        
        const BAND_RULES: { folder: string, multiplier: number, rank: number}[] = [
            { folder: "7 - Agent Memory/",  multiplier: 3, rank: 1 },
            { folder: "3 - Tags/",  multiplier: 0.5, rank: 2 }
        ]

        const bandsList: RbBand[] = []
        const nodesList: RbNode[] = []

        for (const path in LINKS) {
            if (FILTERS.some(filter => path.startsWith(filter))) { continue }
            nodesList.push({ path: path})
        }

        for (const path in LINKS) {
            if (FILTERS.some(filter => path.startsWith(filter))) { continue }

            const sourceRule = BAND_RULES.find(rule => path.startsWith(rule.folder))

            for (const band in LINKS[path]) {
                if (FILTERS.some(filter => band.startsWith(filter))) { continue }
                if (!LINKS[band]) { 
                    if (ATTACHMENTS_VISIBLE) {
                        if (!nodesList.some(node => node.path === band)) {
                            nodesList.push({ path: band })
                        }
                    } else {
                        continue
                    }
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

        const SIMULATION = forceSimulation(nodesList)

        console.debug("nodes:", nodesList.length)
        console.debug("bands:", bandsList.length)

        SIMULATION.force("forceLink", forceLink<RbNode, RbBand>(bandsList).id(node => node.path).distance(band => band.length).strength(LINK))
        SIMULATION.force("forceManyBody", forceManyBody().strength(REPEL * -1))
        SIMULATION.force("forceX", forceX().strength(CENTER))
        SIMULATION.force("forceY", forceY().strength(CENTER))
        SIMULATION.stop()
        SIMULATION.tick(300)
    
        const SHEET = this.contentEl.createSvg("svg", { attr: { width: 1000, height: 1000, viewBox: "-2500 -2500 5000 5000" }})

        for (const band of bandsList) {
            SHEET.createSvg("line", { attr: {
                x1: (band.source as RbNode).x ?? 0,
                y1: (band.source as RbNode).y ?? 0, 
                x2: (band.target as RbNode).x ?? 0, 
                y2: (band.target as RbNode).y ?? 0, 
                stroke: "grey" }})
        }

        for (const node of nodesList) {
            SHEET.createSvg("circle", { attr: { 
                cx: node.x ?? 0,
                cy: node.y ?? 0,
                r: 5,
                fill: "grey" 
            }})
        }

        console.debug(bandsList[0])
        console.debug(nodesList)
    }
}