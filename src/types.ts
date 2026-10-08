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