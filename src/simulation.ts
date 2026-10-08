import { RbBand, RbMessage, RbNode } from './types'
import { bandMultiplier } from './rules'
import {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceX,
    forceY,
    Simulation
} from 'd3-force'

// Obsidian's defaults, held as standing state: forces arrive one key per
// message, a repeat is a slider drag, and a key may never arrive at all.
// repelStrength is kept as sent - positive - and negated at use.
let linkDistance = 250
let repelStrength = 1000
let centerStrength = 0.1
let linkStrength = 1

// Rebuilt whole on every nodes message: d3 keeps the array it was handed and
// never looks for a different one.
let nodes: RbNode[] = []
let bands: RbBand[] = []
let simulation: Simulation<RbNode, RbBand> | null = null

// Stands in for the renderer's worker. It never asks what this is, only calls it.
export class RbWorker {
    // Assigned by the renderer. The only way positions get back.
    onmessage: ((event: { data: unknown }) => void) | null = null

    // Messages are untagged, so the key present is the only signal.
    postMessage(data: RbMessage) {
        if ('forces' in data) {
            // Presence, not truth: 0 is a legitimate value for all four.
            if (data.forces.linkDistance !== undefined) { linkDistance = data.forces.linkDistance }
            if (data.forces.repelStrength !== undefined) { repelStrength = data.forces.repelStrength }
            if (data.forces.centerStrength !== undefined) { centerStrength = data.forces.centerStrength }
            if (data.forces.linkStrength !== undefined) { linkStrength = data.forces.linkStrength }
        }

        if ('nodes' in data) {
            // Positions live on the old objects d3 moved, so index them by
            // path before the list is replaced.
            const previous = new Map(nodes.map(node => [node.path, node]))
            nodes = Object.entries(data.nodes).map(([path, position]) => {
                const node: RbNode = { path }

                // Truthy here is correct: the only falsy value is the false
                // that means "keep this node where it is".
                if (position) {
                    node.x = position[0]
                    node.y = position[1]
                } else {
                    const old = previous.get(path)

                    if (old) {
                        node.x = old.x
                        node.y = old.y
                    }
                }

                return node
            })

            // A band with a missing end throws from inside forceLink's
            // initialize and takes the whole simulation down, so drop it here.
            const present = new Set(nodes.map(node => node.path))
            bands = data.links
                .filter(([source, target]) => present.has(source) && present.has(target))
                .map(([source, target]) => ({
                    source,
                    target,
                    length: linkDistance * bandMultiplier(source, target)
                }))
        }
    }
}

// Owed: the forceNode branch, the gate that creates the simulation once nodes
// have arrived, the tick loop, posting { id, buffer } back through onmessage,
// and terminate forwarding to the parked worker. Band lengths are also still
// built from linkDistance at build time, so a slider drag leaves them stale.
//
// const SIMULATION = forceSimulation(nodesList)
// SIMULATION.force("forceLink", forceLink<RbNode, RbBand>(bandsList).id(node => node.path).distance(band => band.length).strength(linkStrength))
// SIMULATION.force("forceManyBody", forceManyBody().strength(repelStrength * -1))
// SIMULATION.force("forceX", forceX().strength(centerStrength))
// SIMULATION.force("forceY", forceY().strength(centerStrength))

