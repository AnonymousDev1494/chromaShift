document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentH = 160;
    let currentS = 56;
    let currentV = 80;
    let lastPaletteHex = [];
    let savedPaletteCount = 0;
    let savedPalettes = {};

    // DOM Elements
    const sbPicker = document.getElementById('sbPicker');
    const sbHandle = document.getElementById('sbHandle');
    const hueSlider = document.getElementById('hueSlider');
    const hueHandle = document.getElementById('hueHandle');
    const hexInput = document.getElementById('hexInput');
    const swatchPreview = document.getElementById('swatchPreview');
    const paletteGrid = document.getElementById('paletteGrid');
    const toast = document.getElementById('toast');
    const savePaletteBtn = document.getElementById('savePaletteBtn');
    const copyPaletteBtn = document.getElementById('copyPaletteBtn');
    const paletteClipboard = document.getElementById('paletteClipboard');

    // Info Labels
    const valHex = document.getElementById('valHex');
    const valRgb = document.getElementById('valRgb');
    const valHsl = document.getElementById('valHsl');
    const valOklch = document.getElementById('valOklch');

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function updateUI() {
        const rgb = hsvToRgb(currentH, currentS, currentV);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);

        // Update Picker & Previews
        sbPicker.style.backgroundColor = `hsl(${currentH}, 100%, 50%)`;
        swatchPreview.style.backgroundColor = hex;

        // Update Info Banner
        valHex.textContent = hex;
        valRgb.textContent = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        valHsl.textContent = `${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`;
        valOklch.textContent = `${oklch.l.toFixed(2)}, ${oklch.c.toFixed(2)}, ${Math.round(oklch.h)}`;

        // Update Handles (avoid direct style if typing in hex)
        if (document.activeElement !== hexInput) {
            hexInput.value = hex;
        }

        sbHandle.style.left = `${currentS}%`;
        sbHandle.style.top = `${100 - currentV}%`;
        hueHandle.style.left = `${(currentH / 360) * 100}%`;

        generatePalette(rgb);
    }

    function generatePalette(baseRgb) {
        paletteGrid.innerHTML = '';

        // Work in HSL so we can control perceived lightness
        const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);

        // 12-step ramp centered on the selected color (so the selected HEX is included)
        // Includes 0 offset => exact selected color at one slot.
        const offsets = [-45, -38, -30, -22, -14, -7, 0, 7, 14, 22, 30, 38];
        const clamp01 = (n) => Math.max(0, Math.min(100, n));
        const lightnessScale = offsets.map((d) => clamp01(baseHsl.l + d));

        const palette = lightnessScale.map((l, index) => {
            const stepIndex = index; // 0–11
            const t = stepIndex / (lightnessScale.length - 1); // 0–1

            // Keep saturation strong in the middle, softer near extremes
            const saturationFactor = 0.25 + 0.75 * (1 - Math.abs(t - 0.5) * 2);
            const s = Math.max(
                5,
                Math.min(100, baseHsl.s * saturationFactor)
            );

            // Ensure the exact selected color is included
            const isSelectedSlot = offsets[index] === 0;
            const rgb = isSelectedSlot ? baseRgb : hslToRgb(baseHsl.h, s, l);
            const hex = isSelectedSlot ? rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b) : rgbToHex(rgb.r, rgb.g, rgb.b);
            return { rgb, hex, label: String(index + 1) };
        });

        lastPaletteHex = palette.map(p => p.hex);

        // Render with suggested "on-color" text from the same 1–12 palette
        palette.forEach((bg, index) => {
            const suggestedText = pickDesignerTextColor(bg, palette, index);
            const card = createColorCard(bg.hex, bg.label, suggestedText.hex, index);
            paletteGrid.appendChild(card);
        });
    }

    function createColorCard(bgHex, label, textHex, index) {
        const card = document.createElement('div');
        card.className = 'color-card';
        card.style.animationDelay = `${index * 0.05}s`;

        card.innerHTML = `
            <div class="color-swatch" style="background-color: ${bgHex}" onclick="copyColor('${bgHex}')" title="Copy background ${bgHex}"></div>
            <div class="color-info">
                <p class="label-val">${label}</p>
                <span class="hex-val">${bgHex}</span>
                <div class="text-color-col">
                    <div class="text-swatch" style="background-color: ${textHex}" onclick="copyColor('${textHex}')" title="Copy text ${textHex}"></div>
                    <span class="hex-val text-hex">${textHex}</span>
                </div>
                <div class="example-col">
                    <button
                        class="example-btn"
                        type="button"
                        style="background-color: ${bgHex}; color: ${textHex}; border-color: ${textHex};"
                        aria-label="Example button"
                    >
                        Button
                    </button>
                </div>
            </div>
        `;
        return card;
    }

    // Interaction Boilerplate
    function initPicker(el, callback) {
        let isDragging = false;
        const update = (e) => {
            const rect = el.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            callback(x, y);
            updateUI();
        };

        el.addEventListener('mousedown', (e) => { isDragging = true; update(e); });
        window.addEventListener('mousemove', (e) => { if (isDragging) update(e); });
        window.addEventListener('mouseup', () => { isDragging = false; });
    }

    initPicker(sbPicker, (x, y) => {
        currentS = x * 100;
        currentV = (1 - y) * 100;
    });

    initPicker(hueSlider, (x) => {
        currentH = x * 360;
    });

    hexInput.addEventListener('input', (e) => {
        const hex = e.target.value;
        if (/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
            const rgb = hexToRgb(hex.startsWith('#') ? hex : '#' + hex);
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            currentH = hsv.h;
            currentS = hsv.s;
            currentV = hsv.v;
            updateUI();
        }
    });

    // Clipboard
    window.copyColor = (hex) => {
        navigator.clipboard.writeText(hex).then(() => showToast('Copied to clipboard!'));
    };

    function buildPaletteObject() {
        const paletteObj = {};
        for (let i = 0; i < lastPaletteHex.length; i++) {
            paletteObj[String(i + 1)] = lastPaletteHex[i];
        }
        return paletteObj;
    }

    async function copyText(text) {
        await navigator.clipboard.writeText(text);
        showToast('Copied palette JSON!');
    }

    savePaletteBtn?.addEventListener('click', async () => {
        const selectedHex = (hexInput.value || '').trim().toUpperCase();
        savedPalettes[selectedHex] = buildPaletteObject();
        const text = JSON.stringify(savedPalettes, null, 2);
        paletteClipboard.value = text;
        try {
            await copyText(text);
        } catch {
            showToast('Saved (copy blocked by browser)');
        }
    });

    copyPaletteBtn?.addEventListener('click', async () => {
        const text = paletteClipboard.value?.trim();
        if (!text) {
            showToast('Nothing to copy (click Save first)');
            return;
        }
        try {
            await copyText(text);
        } catch {
            showToast('Copy blocked by browser');
        }
    });

    // --- Math Conversions ---

    function hsvToRgb(h, s, v) {
        s /= 100; v /= 100;
        let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
        return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255) };
    }

    function rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    function srgbToLinear(c) {
        const cs = c / 255;
        return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
    }

    function relativeLuminance(rgb) {
        const r = srgbToLinear(rgb.r);
        const g = srgbToLinear(rgb.g);
        const b = srgbToLinear(rgb.b);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contrastRatio(rgb1, rgb2) {
        const l1 = relativeLuminance(rgb1);
        const l2 = relativeLuminance(rgb2);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    function pickDesignerTextColor(bg, palette, bgIndex) {
        // With the palette now centered around the selected color, prefer shades
        // farthest away in the ramp (they usually provide the strongest contrast).
        const targetContrast = 4.5; // good default for normal text

        const candidates = palette
            .map((c, i) => ({ c, i }))
            .filter(({ i }) => i !== bgIndex)
            .sort((a, b) => Math.abs(b.i - bgIndex) - Math.abs(a.i - bgIndex))
            .map(({ c }) => c);

        let best = candidates[0];
        let bestRatio = -Infinity;

        for (const cand of candidates) {
            const ratio = contrastRatio(bg.rgb, cand.rgb);
            if (ratio >= targetContrast) return cand;
            if (ratio > bestRatio) {
                bestRatio = ratio;
                best = cand;
            }
        }

        return best;
    }

    function hexToRgb(hex) {
        if (hex.length === 4) { // #RGB
            const r = parseInt(hex[1] + hex[1], 16);
            const g = parseInt(hex[2] + hex[2], 16);
            const b = parseInt(hex[3] + hex[3], 16);
            return { r, g, b };
        }
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) h = s = 0;
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    function hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;

        const hueToRgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        let r, g, b;

        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hueToRgb(p, q, h + 1 / 3);
            g = hueToRgb(p, q, h);
            b = hueToRgb(p, q, h - 1 / 3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) h = 0;
        else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    }

    function rgbToOklch(r, g, b) {
        const hsl = rgbToHsl(r, g, b);
        return {
            l: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
            c: (hsl.s / 100) * 0.1,
            h: hsl.h
        };
    }

    updateUI();
});
