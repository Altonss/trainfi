import GLib from 'gi://GLib';
import St from 'gi://St';
import Soup from "gi://Soup";


class Stop {
    constructor(label, theoric_date, real_date, is_delayed, is_created, is_diversion, is_removed) {
        this.label = label;
        this.theoric_date = new Date(theoric_date);
        this.real_date = new Date(real_date);
        this.is_delayed = is_delayed;
        this.is_created = is_created;
        this.is_diversion = is_diversion;
        this.is_removed = is_removed;
    }

    inThePast() {
        const now = new Date();
        return now > new Date(this.real_date.getTime() + 5 * 60 * 1000);
    }

    pangoTheoric() {
        const localTime = this.theoric_date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return this.is_delayed ? ` <span foreground="red"><s>${localTime}</s></span>` : ` ‎<span foreground="green">${localTime}</span>`;
    }

    pangoReal() {
        const localTime = this.real_date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return this.is_delayed ? `<span foreground="green">${localTime}</span>` : '';
    }

    pangoFormatedLabel() {
        const [status, color] = this.inThePast()
            ? [' ', 'grey']
            : this.is_created
                ? ['+', 'green']
                : this.is_removed
                    ? ['-', 'red']
                    : this.is_diversion
                        ? ['~', 'yellow']
                        : ['·', 'white'];

        return `<span foreground="${color}"><b>${status}</b></span> ${this.label.replace('&', '&amp;')} `;
    }
}

class Trip {
    constructor(stops) {
        this.stops = stops.map(
            ({ label, theoricDate, realDate, isDelayed, isCreated, isDiversion, isRemoved }) =>
                new Stop(label, theoricDate, realDate, isDelayed, isCreated, isDiversion, isRemoved)
        );
    }
}

export function connected() {
    const [success, out] = GLib.spawn_command_line_sync('nmcli connection show --active');
    const wifiInfo = out.toString();
    return wifiInfo.includes('_SNCF_WIFI_INOUI');
}

export async function speed() {
  return new Promise((resolve, reject) => {
      let _httpSession = new Soup.Session();
      let _message = Soup.Message.new("GET", 'https://wifi.sncf/router/api/train/gps');

      _httpSession.send_and_read_async(_message, GLib.PRIORITY_DEFAULT, null, (sess, result) => {
          try {
              let response = sess.send_and_read_finish(result).get_data();
              let speed_ms = JSON.parse(response)["speed"];
              let speed_val = Math.round(speed_ms * 3.6);
              resolve(speed_val);
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
        let _message = Soup.Message.new("GET", 'https://wifi.sncf/router/api/train/details');

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

export async function displayTrip() {
    try {
        const tripDataAwait = await trip();
        let tripData = new Trip(tripDataAwait["stops"]);
        const formattedStops = tripData.stops.map(stop => `${stop.pangoTheoric()} ${stop.pangoReal()} ${stop.pangoFormatedLabel()}`).join('\n');
        return formattedStops;
    } catch (error) {
        log(`Could not fetch trip details: ${error}`);
        return 'Error fetching trip details';
    }
}
