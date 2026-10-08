// Per-folder band length rules: the lower rank wins when a band joins two folders
const BAND_RULES: { folder: string, multiplier: number, rank: number}[] = [
    { folder: "7 - Agent Memory/",  multiplier: 3, rank: 1 },
    { folder: "3 - Tags/",  multiplier: 0.5, rank: 2 }
]

// How much to stretch or shrink one band, from the folder rules (1 if none apply)
export function bandMultiplier(source: string, target: string): number {
    const sourceRule = BAND_RULES.find(rule => source.startsWith(rule.folder))
    const targetRule = BAND_RULES.find(rule => target.startsWith(rule.folder))

    let multiplier = 1

    if (sourceRule && targetRule) {
        if (sourceRule.rank < targetRule.rank) {
            multiplier = sourceRule.multiplier
        } else if (sourceRule.rank > targetRule.rank) {
            multiplier = targetRule.multiplier
        } else {
            multiplier = (sourceRule.multiplier + targetRule.multiplier) / 2
        }
    } else if (sourceRule) {
        multiplier = sourceRule.multiplier
    } else if (targetRule) {
        multiplier = targetRule.multiplier
    }

    return multiplier
}