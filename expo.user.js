// ==UserScript==
// @name         Oneshot expo
// @namespace    http://tampermonkey.net/
// @version      2024-09-06-01
// @description  Adds buttons to send oneshot expeditions on the bottom of the fleet dispatch page
// @author       n00b
// @updateURL    https://raw.githubusercontent.com/Crypto89/ogame-oneshot-expeditions/main/expo.meta.js
// @downloadURL  https://raw.githubusercontent.com/Crypto89/ogame-oneshot-expeditions/main/expo.user.js
// @match        https://*.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gameforge.com
// ==/UserScript==

const oseSendShips = (order, galaxy, system, planet, planettype, ships, additionalParams) => {
    let params = { mission: order, galaxy: galaxy, system: system, position: planet, type: planettype, shipCount: 0, token: token }

    Object.keys(ships).forEach(function (shipId) {
        additionalParams['am' + shipId] = ships[shipId];
        fleetDispatcher.shipsOnPlanet.find(s => s.id == shipId).number -= ships[shipId];
    });

    if (additionalParams && typeof additionalParams === 'object') {
        Object.keys(additionalParams).map(key => {
            if (!params[key]) {
                params[key] = additionalParams[key]
            }
        })
    }

    $.ajax(miniFleetLink, {
        data: params,
        dataType: "json",
        type: "POST",
        success: (data) => {
            token = data.newAjaxToken;
            updateOverlayToken('phalanxSystemDialog', data.newAjaxToken);
            updateOverlayToken('phalanxDialog', data.newAjaxToken);
            const status = (data.response.success) ? "success" : "error"
            showNotification(data.response.message, status)
        }
    })
}

const sendExpedition = (offset) => {
    return () => {
        if (expeditionCount == maxExpeditionCount) {
            showNotification("Already at maximum expeditions", "error")
            return
        }

        let hasErrors = false;
        let expeditionFleetTemplate, message;
        let idx = 1;
        while (true) {
            expeditionFleetTemplate = expeditionFleetTemplates.find(template => template.name === `oneshot-${idx}`)
            if (typeof expeditionFleetTemplate === undefined) {
                hasErrors = true
                message = "No oneshot expedition template found"
                break
            }

            let invalid = false
            Object.keys(expeditionFleetTemplate.ships).forEach((id) => {
                if (expeditionFleetTemplate.ships[id] > (fleetDispatcher.shipsOnPlanet.find(s => s.id == id) || {number: 0}).number) {
                    invalid = true
                }
            })

            if (invalid) {
                idx++
                continue
            }

            break
        }

        if (hasErrors) {
            showNotification(message, "error")
            return
        }

        let additionalParams = { 'speed': expeditionFleetTemplate.fleetSpeed / 10, 'holdingtime': expeditionFleetTemplate.expeditionTime };

        const cp = fleetDispatcher.currentPlanet

        let system = cp.system + offset
        if (system > 499) {
            system = system - 499
        }
        if (system < 1) {
            system = system + 499
        }

        // oseSendShips
        oseSendShips(15, cp.galaxy, system, 16, 1, expeditionFleetTemplate.ships, additionalParams)
    }
}

(function() {
    'use strict';

    const div = document.createElement("div");
    div.style.display = 'table'
    div.style.displayLayout = 'fixed'
    div.style.width = "100%"

    for (const offset of [-3, -2, -1, 0, 1, 2, 3]) {
        const button = document.createElement("button")
        button.style.display = 'table-cell'
        button.style.textAlign = 'center'
        button.style.fontSize = '24px'
        button.style.marginLeft = '20px'
        button.onclick = sendExpedition(offset)

        if (offset < 0) {
            button.textContent = '- ' + offset*-1
        } else if (offset > 0) {
            button.textContent = '+ ' + offset
        } else {
            button.textContent = 'Inner'
        }

        div.append(button)
    }

    document.querySelector("div#fleet1").append(div)

    document.onkeydown = (e) => {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        var char = e.which;
        if (!char) return;
        if (e.which == 69) {
            // sendExpedition()
        }
    };
})();
