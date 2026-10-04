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

// A node is one note, with its path and the x and y the simulation fills in
interface RbNode extends SimulationNodeDatum {
    path: string
}

// A band is one link between two nodes, with the length it tries to hold
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

    // Runs when the view opens: builds the graph, draws it and wires up the zoom
    async onOpen() {
        this.contentEl.empty()
        
        // Read the vault's links and the ignore filters from Obsidian's app settings
        const LINKS = this.app.metadataCache.resolvedLinks
        const APP = this.app.vault.configDir + "/app.json"
        const APP_SETTINGS = await this.app.vault.adapter.read(APP)
        const FILTERS = (JSON.parse(APP_SETTINGS) as { userIgnoreFilters?: string[] })["userIgnoreFilters"] ?? []

        // Where the graph view's own settings live, and the shape of what they can hold
        const GRAPH = this.app.vault.configDir + "/graph.json"

        let PREFERENCES: { 
            linkDistance?: number, 
            repelStrength?: number, 
            centerStrength?: number, 
            linkStrength?: number, 
            showAttachments?: boolean 
        } = {}

        // Load graph.json into PREFERENCES, or keep the defaults if it can't be read
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


        // Turn the graph settings into numbers for the simulation, with defaults
        const DISTANCE = PREFERENCES["linkDistance"] ?? 250
        const REPEL = Math.max(Math.pow(PREFERENCES["repelStrength"] ?? 10, 3), 1)
        const CENTER = SLIDER_CURVE(PREFERENCES["centerStrength"] ?? 0.518713248970312)
        const LINK = SLIDER_CURVE(PREFERENCES["linkStrength"] ?? 1)
        const ATTACHMENTS_VISIBLE = PREFERENCES["showAttachments"] ?? true
        
        // Per-folder band length rules: the lower rank wins when a band joins two folders
        const BAND_RULES: { folder: string, multiplier: number, rank: number}[] = [
            { folder: "7 - Agent Memory/",  multiplier: 3, rank: 1 },
            { folder: "3 - Tags/",  multiplier: 0.5, rank: 2 }
        ]

        // Empty lists to fill: bands (the links) and nodes (the notes)
        const bandsList: RbBand[] = []
        const nodesList: RbNode[] = []

        // First pass: one node for every note that isn't filtered out
        for (const path in LINKS) {
            if (FILTERS.some(filter => path.startsWith(filter))) { continue }
            nodesList.push({ path: path})
        }

        // Second pass: one band for every link, plus a node for a linked attachment if attachments are shown
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
                
                // Pick how much to stretch or shrink this band from the folder rules (1 if none apply)
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

                // Record the band with its final length
                bandsList.push({ source: path, target: band, length: (DISTANCE * bandMultiplier) })
            }
        }
        
        // Run the force simulation to the end so every node has an x and y before drawing
        const SIMULATION = forceSimulation(nodesList)

        SIMULATION.force("forceLink", forceLink<RbNode, RbBand>(bandsList).id(node => node.path).distance(band => band.length).strength(LINK))
        SIMULATION.force("forceManyBody", forceManyBody().strength(REPEL * -1))
        SIMULATION.force("forceX", forceX().strength(CENTER))
        SIMULATION.force("forceY", forceY().strength(CENTER))
        SIMULATION.stop()
        SIMULATION.tick(300)
        
        // Viewbox values
        let minX = -2500
        let minY = -2500
        let windowSize = 5000

        // The svg sheet that everything is drawn on
        const SHEET = this.contentEl.createSvg("svg", { attr: { 
            width: "100%", 
            height: "100%", 
            viewBox: `${minX} ${minY} ${windowSize} ${windowSize}`
        }})


        // Draw a grey line for every band
        for (const band of bandsList) {
            SHEET.createSvg("line", { attr: {
                x1: (band.source as RbNode).x ?? 0,
                y1: (band.source as RbNode).y ?? 0, 
                x2: (band.target as RbNode).x ?? 0, 
                y2: (band.target as RbNode).y ?? 0, 
                stroke: "grey" }})
        }

        // Holds every node's label so the zoom handler can show and hide them
        const LABELS: SVGTextElement[] = []
        

        // Draw a dot and a hidden file name label for every node
        for (const node of nodesList) {
            const NODE_LABEL = this.app.vault.getFileByPath(node.path)

            SHEET.createSvg("circle", { attr: { 
                cx: node.x ?? 0,
                cy: node.y ?? 0,
                r: 5,
                fill: "grey" 
            }})

            const LABEL = SHEET.createSvg("text", { attr: { 
                x: node.x ?? 0,
                y: (node.y ?? 0)  + 20,
                "text-anchor": "middle",
                "visibility": "hidden",
                fill: "white"
            }})

            LABEL.setText(NODE_LABEL?.basename ?? node.path)
            LABELS.push(LABEL)
        }

        // Obsidian's graph view: x1.5 for every 120 of deltaY
        const ZOOM_MULTIPLIER = 1.5

        // On every scroll: work out the zoom, show or hide the labels, then move the viewbox
        this.registerDomEvent(this.contentEl, "wheel", (event) => {
            event.preventDefault()

            // Convert the mouse position into sheet coordinates, the point the zoom keeps still
            const MATRIX = SHEET.getScreenCTM()

            if (!MATRIX) { return }

            const ANCHOR = new DOMPoint(event.clientX, event.clientY).matrixTransform(MATRIX.inverse())

            // The zoom limits are measured from the sheet's size on screen
            const sheetSize = Math.min(SHEET.clientWidth, SHEET.clientHeight)
            const minWindowSize = (sheetSize / 4)
            const maxWindowSize = sheetSize * 128

            // Apply the scroll to windowSize, then keep it inside the limits
            const fixedSize = windowSize

            windowSize = windowSize * ZOOM_MULTIPLIER ** (event.deltaY / 120)

            if (windowSize < minWindowSize) {
                windowSize = minWindowSize
            } else if (windowSize > maxWindowSize) {
                windowSize = maxWindowSize
            }

            // Show the labels when zoomed in far enough, hide them otherwise
            for (const label of LABELS) {
                if (windowSize <= minWindowSize * 8) {
                    label.setAttr("visibility", `visible`)
                } else if (windowSize > minWindowSize * 8) {
                    label.setAttr("visibility", `hidden`)
                }
            }

            // Move the viewbox's top left corner so the point under the mouse stays put
            const shrinkSize = windowSize / fixedSize
            const anchorGapX = ANCHOR.x - minX
            minX = ANCHOR.x - anchorGapX * shrinkSize

            const anchorGapY = ANCHOR.y - minY
            minY = ANCHOR.y - anchorGapY * shrinkSize

            // Apply the new viewbox to the sheet
            SHEET.setAttr("viewBox", `${minX} ${minY} ${windowSize} ${windowSize}`)
        })

    }
}