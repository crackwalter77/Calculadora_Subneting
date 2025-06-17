// subneteo.js
// Lógica principal de subneteo y generación de comandos para la calculadora web

function calcular() {
    const redBase = document.getElementById('redBase').value.trim();
    const numSubredes = parseInt(document.getElementById('numSubredes').value);
    const hostsList = document.getElementById('hostsList').value.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
    const tipoEnrutamiento = document.getElementById('tipoEnrutamiento').value;
    const tablasDiv = document.getElementById('tablas');
    const comandosTA = document.getElementById('comandos');
    tablasDiv.innerHTML = '';
    comandosTA.value = '';

    // Validaciones básicas
    if (!redBase || isNaN(numSubredes) || hostsList.length === 0) {
        alert('Completa todos los campos correctamente.');
        return;
    }

    // Cálculo de subredes (IPv4)
    let subnets = calcularSubredes(redBase, numSubredes);
    if (!subnets) {
        alert('Red base inválida o no se pueden crear subredes.');
        return;
    }
    let {subredes, mascara, salto, octeto} = subnets;

    // Cálculo de subredes para hosts
    let hostSubnets = calcularSubredesParaHosts(subredes[subredes.length-1].broadcast+1, hostsList);
    if (!hostSubnets) {
        alert('No se pueden calcular subredes para hosts.');
        return;
    }

    // Mostrar tablas
    tablasDiv.innerHTML = generarTablas(subredes, mascara, salto, octeto, hostSubnets, hostsList);

    // Generar comandos
    comandosTA.value = generarComandos(hostSubnets, tipoEnrutamiento);
}

// --- Funciones de subneteo ---
function ipToInt(ip) {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
}
function intToIp(int) {
    return [24,16,8,0].map(shift => (int >> shift) & 255).join('.');
}
function prefixToMask(prefix) {
    let mask = [];
    for (let i = 0; i < 4; i++) {
        mask.push((prefix >= 8) ? 255 : (prefix > 0 ? (256 - Math.pow(2, 8-prefix)) : 0));
        prefix -= 8;
        if (prefix < 0) prefix = 0;
    }
    return mask.join('.');
}
function calcularSubredes(redBase, numSubredes) {
    try {
        let [ip, prefix] = redBase.split('/');
        prefix = parseInt(prefix);
        let baseInt = ipToInt(ip);
        let bits = 0;
        while (Math.pow(2, bits) < numSubredes) bits++;
        let newPrefix = prefix + bits;
        if (newPrefix > 30) return null;
        let salto = Math.pow(2, 32 - newPrefix);
        let subredes = [];
        for (let i = 0; i < numSubredes; i++) {
            let netInt = baseInt + i * salto;
            subredes.push({
                red: intToIp(netInt),
                prefix: newPrefix,
                mascara: prefixToMask(newPrefix),
                broadcast: netInt + salto - 1
            });
        }
        return {subredes, mascara: prefixToMask(newPrefix), salto, octeto: Math.ceil(newPrefix/8)};
    } catch {
        return null;
    }
}
function calcularSubredesParaHosts(startInt, hostsList) {
    let subnets = [];
    let current = startInt;
    for (let hosts of hostsList) {
        let needed = hosts + 2;
        let bits = 0;
        while (Math.pow(2, bits) < needed) bits++;
        let prefix = 32 - bits;
        let size = Math.pow(2, bits);
        let netInt = current;
        subnets.push({
            red: intToIp(netInt),
            prefix,
            mascara: prefixToMask(prefix),
            broadcast: intToIp(netInt + size - 1),
            gateway: intToIp(netInt + 1),
            ip_pc: intToIp(netInt + 2),
            size,
            hosts
        });
        current = netInt + size;
    }
    return subnets;
}

// --- Generar tablas HTML ---
function generarTablas(subredes, mascara, salto, octeto, hostSubnets, hostsList) {
    let html = '<h3>Subredes</h3>';
    html += '<table><tr><th>N°</th><th>Red</th><th>CIDR</th><th>Máscara</th><th>Broadcast</th><th>Salto</th></tr>';
    subredes.forEach((s, i) => {
        // Calcular el salto real: 256 - valor del octeto de la máscara correspondiente
        let maskParts = s.mascara.split('.').map(Number);
        let octeto = 1;
        let salto = 0;
        if (s.prefix <= 8) {
            octeto = 1;
            salto = 256 - maskParts[0];
        } else if (s.prefix <= 16) {
            octeto = 2;
            salto = 256 - maskParts[1];
        } else if (s.prefix <= 24) {
            octeto = 3;
            salto = 256 - maskParts[2];
        } else {
            octeto = 4;
            salto = 256 - maskParts[3];
        }
        let saltoStr = `${salto} en el ${octeto}º octeto`;
        html += `<tr><td>${i+1}</td><td>${s.red}</td><td>/${s.prefix}</td><td>${s.mascara}</td><td>${intToIp(s.broadcast)}</td><td>${saltoStr}</td></tr>`;
    });
    html += '</table>';
    html += '<h3>Subredes para hosts</h3>';
    html += '<table><tr><th>N°</th><th>Dirección de Red</th><th>Máscara</th><th>Host</th><th>Salto</th><th>Direcciones válidas</th><th>Gateway</th><th>Broadcast</th></tr>';
    hostSubnets.forEach((s, i) => {
        let dirRed = s.red + '/' + s.prefix;
        // Calcular el salto y el octeto correspondiente
        let maskParts = s.mascara.split('.').map(Number);
        let octeto = 1;
        let salto = 0;
        if (s.prefix <= 8) {
            octeto = 1;
            salto = 256 - maskParts[0];
        } else if (s.prefix <= 16) {
            octeto = 2;
            salto = 256 - maskParts[1];
        } else if (s.prefix <= 24) {
            octeto = 3;
            salto = 256 - maskParts[2];
        } else {
            octeto = 4;
            salto = 256 - maskParts[3];
        }
        let saltoStr = `${salto} en el ${octeto}º octeto`;
        let ipValidaIni = intToIp(ipToInt(s.red) + 2);
        let ipValidaFin = intToIp(ipToInt(s.broadcast) - 1);
        let direccionesValidas = (ipToInt(ipValidaIni) <= ipToInt(ipValidaFin)) ? `${ipValidaIni} – ${ipValidaFin}` : '-';
        html += `<tr><td>${i+1}</td><td>${dirRed}</td><td>${s.mascara}</td><td>${s.hosts}</td><td>${saltoStr}</td><td>${direccionesValidas}</td><td>${s.gateway}</td><td>${s.broadcast}</td></tr>`;
    });
    html += '</table>';
    return html;
}

// --- Generar comandos Cisco ---
function generarComandos(hostSubnets, tipo) {
        let comandos = [];
        let totalRouters = hostSubnets.length + 1; // Para n LANs, n+1 routers (enlaces seriales)
        // Calcular subredes seriales /30
        let serialSubnets = [];
        let baseSerial = ipToInt('10.10.10.0');
        for (let i = 0; i < totalRouters - 1; i++) {
            let netInt = baseSerial + i * 4;
            serialSubnets.push({
                red: intToIp(netInt),
                mask: '255.255.255.252',
                ip1: intToIp(netInt + 1),
                ip2: intToIp(netInt + 2),
                broadcast: intToIp(netInt + 3)
            });
        }
        for (let i = 0; i < totalRouters; i++) {
            comandos.push(`! =============================`);
            comandos.push(`! Comandos para Router R${i}`);
            comandos.push(`! =============================`);
            // Giga
            if (i < hostSubnets.length) {
                comandos.push(`interface gig0/0`);
                comandos.push(` ip address ${hostSubnets[i].gateway} ${hostSubnets[i].mascara}`);
                comandos.push(` no shutdown`);
                comandos.push(`! Conectar a Switch S${i+1} y PC${i+1} (ejemplo)`);
                comandos.push(`! PC${i+1} IP: ${hostSubnets[i].ip_pc} / Máscara: ${hostSubnets[i].mascara} / Gateway: ${hostSubnets[i].gateway}`);
            }
            // Seriales
            if (i > 0) {
                // Serial previo
                comandos.push(`interface serial0/0/${i-1}`);
                comandos.push(` ip address ${serialSubnets[i-1].ip2} ${serialSubnets[i-1].mask}`);
                comandos.push(` no shutdown`);
            }
            if (i < serialSubnets.length) {
                // Serial siguiente
                comandos.push(`interface serial0/0/${i}`);
                comandos.push(` ip address ${serialSubnets[i].ip1} ${serialSubnets[i].mask}`);
                comandos.push(` clock rate 64000`);
                comandos.push(` no shutdown`);
            }
            // Enrutamiento
            if (tipo === 'rip') {
                let redesRip = [];
                if (i < hostSubnets.length) redesRip.push(hostSubnets[i].red);
                if (i > 0) redesRip.push(serialSubnets[i-1].red);
                if (i < serialSubnets.length) redesRip.push(serialSubnets[i].red);
                comandos.push('router rip');
                comandos.push(' version 2');
                redesRip.forEach(r => comandos.push(` network ${r}`));
                comandos.push(' no auto-summary');
            } else {
                // Estático: rutas para todas las redes no conectadas directamente
                let redes = [];
                hostSubnets.forEach(h => redes.push({red: h.red, mask: h.mascara}));
                serialSubnets.forEach(s => redes.push({red: s.red, mask: s.mask}));
                // Redes directamente conectadas
                let directas = [];
                if (i < hostSubnets.length) directas.push(hostSubnets[i].red);
                if (i > 0) directas.push(serialSubnets[i-1].red);
                if (i < serialSubnets.length) directas.push(serialSubnets[i].red);
                // Rutas estáticas
                for (let r of redes) {
                    if (!directas.includes(r.red)) {
                        // Buscar siguiente salto
                        let nextHop = '';
                        // Si la red es LAN de otro router
                        let idxLan = hostSubnets.findIndex(h => h.red === r.red);
                        if (idxLan !== -1) {
                            // Si estoy antes, salto por serial siguiente, si después, por serial previo
                            if (i < idxLan) nextHop = serialSubnets[i].ip2;
                            else nextHop = serialSubnets[i-1].ip1;
                        } else {
                            // Es una red serial
                            let idxSer = serialSubnets.findIndex(s => s.red === r.red);
                            if (idxSer !== -1) {
                                if (i <= idxSer) nextHop = serialSubnets[i].ip2;
                                else nextHop = serialSubnets[i-1].ip1;
                            }
                        }
                        comandos.push(`ip route ${r.red} ${r.mask} ${nextHop}`);
                    }
                }
            }
            comandos.push('! =============================\n');
        }
        comandos.push('! Recuerda asignar las IPs a las PCs y switches según corresponda');
        return comandos.join('\n');
}
