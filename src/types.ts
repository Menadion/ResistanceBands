import {
    SimulationLinkDatum,
    SimulationNodeDatum
} from 'd3-force'


// A node is one note, with its path and the x and y the simulation fills in
export interface RbNode extends SimulationNodeDatum {
    path: string
}

// A band is one link between two nodes, with the length it tries to hold
export interface RbBand extends SimulationLinkDatum<RbNode> {
    source: RbNode | string,
    target: RbNode | string,
    length: number
}

// The three message shapes the renderer posts. Untagged: the key present tells
// them apart, so each force field is optional.
export interface RbForcesMessage {
    forces: {
        centerStrength?: number,
        linkStrength?: number,
        linkDistance?: number,
        repelStrength?: number
    },
    alpha?: number,
    alphaTarget?: number,
    run?: boolean
}

export interface RbNodesMessage {
    nodes: Record<string, [number, number] | false>,
    links: [string, string][],
    alpha?: number,
    run?: boolean
}

export interface RbForceNodeMessage {
    forceNode: { id: string, x: number, y: number },
    alpha?: number,
    alphaTarget?: number,
    run?: boolean
}

export type RbMessage = RbForcesMessage | RbNodesMessage | RbForceNodeMessage