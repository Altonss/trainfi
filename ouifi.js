import GLib from 'gi://GLib';
import Soup from 'gi://Soup';


class Stop {
    constructor(label, theoricDate, realDate, isDelayed, isCreated, isDiversion, isRemoved) {
        this.label = label;
        this.theoricDate = new Date(theoricDate);
        this.realDate = new Date(realDate);
        this.isDelayed = isDelayed;
        this.isCreated = isCreated;
        this.isDiversion = isDiversion;
        this.isRemoved = isRemoved;
    }

    inThePast() {
        const now = new Date();
        return now > new Date(this.realDate.getTime() + 5 * 60 * 1000);
    }

    pangoTheoric() {
        const localTime = this.theoricDate.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
        return this.isDelayed ? ` <span foreground="red"><s>${localTime}</s></span>` : ` ‎<span foreground="green">${localTime}</span>`;
    }

    pangoReal() {
        const localTime = this.realDate.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
        return this.isDelayed ? `<span foreground="green">${localTime}</span>` : '';
    }

    pangoFormatedLabel() {
        const [status, color] = this.inThePast()
            ? [' ', 'grey']
            : this.isCreated
                ? ['+', 'green']
                : this.isRemoved
                    ? ['-', 'red']
                    : this.isDiversion
                        ? ['~', 'yellow']
                        : ['·', 'white'];

        return `<span foreground="${color}"><b>${status}</b></span> ${this.label.replace('&', '&amp;')} `;
    }
}

class Trip {
    constructor(stops) {
        this.stops = stops.map(
            ({label, theoricDate, realDate, isDelayed, isCreated, isDiversion, isRemoved}) =>
                new Stop(label, theoricDate, realDate, isDelayed, isCreated, isDiversion, isRemoved)
        );
    }
}

// Check if connected to onboard Wi-Fi
export function connected() {
    const [, out] = GLib.spawn_command_line_sync('nmcli connection show --active');
    const wifiInfo = out.toString();
    return wifiInfo.includes('_SNCF_WIFI_INOUI');
}

// Get train speed from API endpoint
export async function speed() {
    return new Promise((resolve, reject) => {
        let _httpSession = new Soup.Session();
        let _message = Soup.Message.new('GET', 'https://wifi.sncf/router/api/train/gps');

        _httpSession.send_and_read_async(_message, GLib.PRIORITY_DEFAULT, null, (sess, result) => {
            try {
                let response = sess.send_and_read_finish(result).get_data();
                let speedMs = JSON.parse(response)['speed'];
                let speedVal = Math.round(speedMs * 3.6);
                resolve(speedVal);
            } catch (e) {
                sess.abort();
                reject(e);
            }
        });
    });
}

function trip() {
    return new Promise((resolve, reject) => {
        let _httpSession = new Soup.Session();
        let _message = Soup.Message.new('GET', 'https://wifi.sncf/router/api/train/details');

        _httpSession.send_and_read_async(_message, GLib.PRIORITY_DEFAULT, null, (sess, result) => {
            try {
                let response = sess.send_and_read_finish(result).get_data();
                let json = JSON.parse(response);
                resolve(json);
            } catch (e) {
                sess.abort();
                reject(e);
            }
        });
    });
}

// Return trip details, ready for display in pango markup
export async function displayTrip() {
    try {
        const tripDataAwait = await trip();
        let tripData = new Trip(tripDataAwait['stops']);
        const formattedStops = tripData.stops.map(stop => `${stop.pangoTheoric()} ${stop.pangoReal()} ${stop.pangoFormatedLabel()}`).join('\n');
        return formattedStops;
    } catch (error) {
        log(`Could not fetch trip details: ${error}`);
        return 'Error fetching trip details';
    }
}
