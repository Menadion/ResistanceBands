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
    }
};