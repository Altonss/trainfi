import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Ouifi from './ouifi.js';

export default class ExampleExtension extends Extension {
    enable() {
        // Initial check and enable if connected
        this._checkAndEnable();

        // Set up an interval check every 2 seconds
        this._checkConnectionIntervalId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._checkAndEnable();
            return true;  // Keep the interval running
        });
    }

    disable() {
        // Clear the interval check when the extension is disabled
        if (this._checkConnectionIntervalId !== 0) {
            GLib.source_remove(this._checkConnectionIntervalId);
            this._checkConnectionIntervalId = 0;
        }

        // Disable the extension indicator
        this._disable();
    }

    _disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }

    _checkAndEnable() {
        // Check if connected before enabling the extension
        if (Ouifi.connected()) {
            // Enable the extension if not already enabled
            if (!this._indicator) {
                this._enable();
            } else {
                this._updateInfo();
            }
        } else {
            if (this._indicator) {
                this._disable();
            }
        }
    }

    _enable() {
        // Create a panel button
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        this._label = new St.Label({
            text: '🚄 ??? km/h',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._indicator.add_child(this._label);

        // Add the indicator to the panel
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this.tripDetails = new PopupMenu.PopupMenuItem('No trip info available for now...', {reactive: false});
        this.tripDetails.label.style = 'font-family: monospace; background-color: black;';
        this._indicator.menu.addMenuItem(this.tripDetails);

        this._updateInfo();
    }

    async _updateInfo() {
        // Update speed
        try {
            const speedValue = await Ouifi.speed();
            this._label.text = `🚄 ${speedValue} km/h`;
        } catch (error) {
            this._label.text = '🚄 ??? km/h';
            console.error('Error occurred while fetching speed:', error);
        }

        // Update trip details
        Ouifi.displayTrip().then(tripDetailsMarkup => {
            this.tripDetails.label.clutter_text.set_markup(tripDetailsMarkup);
        }).catch(error => {
            logError(error, 'Failed to fetch trip details.');
        });
    }
}
