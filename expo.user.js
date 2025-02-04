// ==UserScript==
// @name         Oneshot expo
// @namespace    http://tampermonkey.net/
// @version      2025-02-04-01
// @description  Adds buttons to send oneshot expeditions on the bottom of the fleet dispatch page
// @author       n00b
// @updateURL    https://raw.githubusercontent.com/Crypto89/ogame-oneshot-expeditions/main/expo.meta.js
// @downloadURL  https://raw.githubusercontent.com/Crypto89/ogame-oneshot-expeditions/main/expo.user.js
// @match        https://*.ogame.gameforge.com/game/index.php?page=ingame&component=fleetdispatch*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gameforge.com
// ==/UserScript==

const oseSendShips = (order, galaxy, system, planet, planettype, ships, additionalParams, callback) => {
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
            callback(data, status)
        }
    })
}

const showNotificationCallback = (data, status) => {
    showNotification(data.response.message, status)
}

const sendExpedition = (offset, callback) => {
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
        oseSendShips(15, cp.galaxy, system, 16, 1, expeditionFleetTemplate.ships, additionalParams, callback)
    }
}

const sendCollect = (callback) => {
    return () => {
        const totalRes = ['metal','crystal','deuterium'].
        map(t => Math.floor(resourcesBar.resources[t].amount)).
        reduce((a, b) => a+b, 0)

        const totalCargos = Math.ceil(totalRes / shipsData['203'].baseCargoCapacity)
        console.log(totalRes, '=>', totalCargos)

        const cp = fleetDispatcher.currentPlanet

        //
        $.ajax(sendFleetUrl, {
            data: {
                am203: totalCargos,
                mission: 3,
                galaxy: cp.galaxy,
                system: cp.system,
                position: cp.position,
                type: 3,
                metal: Math.floor(resourcesBar.resources['metal'].amount),
                crystal: Math.floor(resourcesBar.resources['crystal'].amount),
                deuterium: Math.floor(resourcesBar.resources['deuterium'].amount),
                speed: 10,
                token: token
            },
            type: "POST",
            success: (data) => {
                const response = JSON.parse(data)
                console.log(response);
                token = response.newAjaxToken;
                updateOverlayToken('phalanxSystemDialog', response.newAjaxToken);
                updateOverlayToken('phalanxDialog', response.newAjaxToken);
                const status = (response.success) ? "success" : "error"
                callback(response.message, status)
            }
        })
    }
}

const findNextPlanet = () => {
    const planets = document.querySelectorAll('#planetList > div')
    const currentType = document.querySelector('meta[name="ogame-planet-type"]').attributes['content'].value

    let nextLink = null

    planets.forEach((planet, index) => {
        const active = planet.querySelector('.active') != null
        if (!active) return

        const nextPlanet = planets[(index+1)%planets.length]

        let next = nextPlanet.querySelector(`.${currentType}link`)
        if (next == null) {
            nextPlanet.querySelector(`.planetlink`)
        }
        nextLink = next.href
    })

    return nextLink
}

const nextPlanet = () => {
    document.location.href = findNextPlanet()
}

const addRelativeButtons = () => {
    const tr = document.createElement("tr")
    for (const offset of [-3, -2, -1, 0, 1, 2, 3]) {
        const button = document.createElement("button")
        button.style.display = 'block'
        button.style.margin = 'auto'
        button.style.textAlign = 'center'
        button.style.fontSize = '32px'
        button.onclick = sendExpedition(offset, showNotificationCallback)

        if (offset < 0) {
            button.textContent = '- ' + offset*-1
        } else if (offset > 0) {
            button.textContent = '+ ' + offset
        } else {
            button.textContent = 'Inner'
        }

        const td = document.createElement("td")
        td.style.paddingBottom = '10px'
        td.append(button)
        tr.append(td)
    }

    return tr
}

const addQuickNext = () => {
    const tr = document.createElement("tr")

    const quick = document.createElement("button")
    quick.style.display = 'block'
    quick.style.margin = 'auto'
    quick.style.textAlign = 'center'
    quick.style.fontSize = '32px'
    quick.onclick = sendExpedition(0, nextPlanet)
    quick.textContent = 'Inner >>'
    const quickTd = document.createElement("td")
    quickTd.style.paddingBottom = '10px'
    quickTd.colSpan = 3
    quickTd.append(quick)

    const next = document.createElement("button")
    next.style.display = 'block'
    next.style.margin = 'auto'
    next.style.textAlign = 'center'
    next.style.fontSize = '24px'
    next.onclick = nextPlanet
    next.textContent = '>>'
    const nextTd = document.createElement("td")
    nextTd.style.paddingBottom = '10px'
    nextTd.colSpan = 3
    nextTd.append(next)

    const spacer = document.createElement("td")

    tr.append(quickTd)
    tr.append(spacer)
    tr.append(nextTd)

    return tr
}

const addQuickCollect = () => {
    const tr = document.createElement('tr')
    tr.style.marginTop = '4px'
    const collect = document.createElement("button")
    collect.style.display = 'block'
    collect.style.margin = 'auto'
    collect.style.textAlign = 'center'
    collect.style.fontSize = '32px'
    collect.onclick = sendCollect(showNotification)
    collect.textContent = "Collect ︽"
    const collectTd = document.createElement("td")
    collectTd.colSpan = 3
    collectTd.append(collect)

    const spacer = document.createElement("td")

    const collectNext = document.createElement("button")
    collectNext.style.display = 'block'
    collectNext.style.margin = 'auto'
    collectNext.style.textAlign = 'center'
    collectNext.style.fontSize = '32px'
    collectNext.onclick = sendCollect(nextPlanet)
    collectNext.textContent = "Collect ︽ >>"
    const collectNextTd = document.createElement("td")
    collectNextTd.colSpan = 3
    collectNextTd.append(collectNext)


    tr.append(collectTd)
    tr.append(spacer)
    tr.append(collectNextTd)

    return tr
}

(function() {
    'use strict';

    const table = document.createElement("table");
    table.style.width = "100%"
    table.append(addRelativeButtons());
    table.append(addQuickNext());
    table.append(addQuickCollect());

    document.querySelector("div#fleet1").append(table)

    document.onkeydown = (e) => {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        var char = e.which;
        if (!char) return;
        if (e.which == 69) {
            // sendExpedition()
        }
    };
})();
