document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentH = 160;
    let currentS = 56;
    let currentV = 80;
    let lastPaletteHex = [];
    let savedPaletteCount = 0;
    let savedPalettes = {};
    let currentSelectedHex = '#4ECCA3';

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

    // Hover Preview (duplicate panel)
    const hoverPreviewPanel = document.getElementById('hoverPreviewPanel');
    const sbPickerHover = document.getElementById('sbPickerHover');
    const sbHandleHover = document.getElementById('sbHandleHover');
    const hueSliderHover = document.getElementById('hueSliderHover');
    const hueHandleHover = document.getElementById('hueHandleHover');
    const hexInputHover = document.getElementById('hexInputHover');
    const swatchPreviewHover = document.getElementById('swatchPreviewHover');

    const valHexHover = document.getElementById('valHexHover');
    const valRgbHover = document.getElementById('valRgbHover');
    const valHslHover = document.getElementById('valHslHover');
    const valOklchHover = document.getElementById('valOklchHover');

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
        currentSelectedHex = hex;

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

    function setHoverPreviewInactive(isInactive) {
        if (!hoverPreviewPanel) return;
        hoverPreviewPanel.classList.toggle('is-inactive', isInactive);
    }

    function clearHoverPreview() {
        if (!hoverPreviewPanel) return;
        setHoverPreviewInactive(true);
        if (valHexHover) valHexHover.textContent = '—';
        if (valRgbHover) valRgbHover.textContent = '—';
        if (valHslHover) valHslHover.textContent = '—';
        if (valOklchHover) valOklchHover.textContent = '—';
        if (hexInputHover) hexInputHover.value = '';
        if (swatchPreviewHover) swatchPreviewHover.style.backgroundColor = 'transparent';
        if (sbPickerHover) sbPickerHover.style.backgroundColor = `hsl(0, 100%, 50%)`;
        if (sbHandleHover) {
            sbHandleHover.style.left = `0%`;
            sbHandleHover.style.top = `100%`;
        }
        if (hueHandleHover) hueHandleHover.style.left = `0%`;
    }

    function updateHoverPreviewFromHex(hex) {
        if (!hoverPreviewPanel) return;
        const normalized = (hex || '').trim().toUpperCase();
        if (!/^#[0-9A-F]{6}$/.test(normalized)) return;

        const rgb = hexToRgb(normalized);
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);

        setHoverPreviewInactive(false);

        if (swatchPreviewHover) swatchPreviewHover.style.backgroundColor = normalized;
        if (hexInputHover) hexInputHover.value = normalized;

        if (valHexHover) valHexHover.textContent = normalized;
        if (valRgbHover) valRgbHover.textContent = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        if (valHslHover) valHslHover.textContent = `${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`;
        if (valOklchHover) valOklchHover.textContent = `${oklch.l.toFixed(2)}, ${oklch.c.toFixed(2)}, ${Math.round(oklch.h)}`;

        // Preview picker visuals (non-interactive)
        if (sbPickerHover) sbPickerHover.style.backgroundColor = `hsl(${hsv.h}, 100%, 50%)`;
        if (sbHandleHover) {
            sbHandleHover.style.left = `${hsv.s}%`;
            sbHandleHover.style.top = `${100 - hsv.v}%`;
        }
        if (hueHandleHover) hueHandleHover.style.left = `${(hsv.h / 360) * 100}%`;
    }

    function generatePalette(baseRgb) {
        paletteGrid.innerHTML = '';

        // Designer-specified HSL lightness scale (bottom -> top):
        // 5, 15, 25, 30, 40, 50, 60, 70, 80, 90, 95, 98
        // In the UI (top -> bottom) we render reversed: 98 ... 5
        // Also ensure the exact selected color is included by replacing the closest-L slot.

        const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
        const hueRounded = ((Math.round(baseHsl.h) % 360) + 360) % 360;
        const isHueZero = hueRounded === 0;
        const isNearNeutral = baseHsl.s < 12; // hue often collapses to 0 when saturation is very low
        const lightnessTopToBottom = [98, 95, 90, 80, 70, 60, 50, 40, 30, 25, 15, 5];

        const palette = lightnessTopToBottom.map((l, index) => {
            const t = index / (lightnessTopToBottom.length - 1); // 0..1 (top -> bottom)

            // Keep saturation stronger mid-scale, softer near extremes.
            // Special-case hue=0:
            // - Near-neutral (low saturation): keep it truly neutral (avoid accidental red tint).
            // - Red family: optimize darkest tones (#11/#12) to stay "shade-like" (less muddy).
            let h = baseHsl.h;
            let s;

            if (isHueZero && isNearNeutral) {
                h = 0;
                s = 0;
            } else {
                const midBoost = 1 - Math.abs(t - 0.5) * 2; // 0..1..0
                let saturationFactor = 0.22 + 0.78 * midBoost;

                // Extra desaturation for very dark tones (especially visible for reds).
                if (l <= 25) {
                    const darkT = (25 - l) / 25; // 0..1
                    saturationFactor *= 1 - 0.35 * darkT;
                }

                // Stronger tuning for the last two shades when hue is 0.
                if (isHueZero && index >= 10) {
                    saturationFactor *= 0.55;
                }

                s = Math.max(0, Math.min(100, baseHsl.s * saturationFactor));
            }

            const rgb = hslToRgb(h, s, l);
            const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
            return { rgb, hex, label: String(index + 1), l };
        });

        // Replace the closest lightness slot with the exact selected color.
        let closestIndex = 0;
        let closestDist = Infinity;
        for (let i = 0; i < palette.length; i++) {
            const d = Math.abs(palette[i].l - baseHsl.l);
            if (d < closestDist) {
                closestDist = d;
                closestIndex = i;
            }
        }
        palette[closestIndex] = {
            ...palette[closestIndex],
            rgb: baseRgb,
            hex: rgbToHex(baseRgb.r, baseRgb.g, baseRgb.b)
        };

        lastPaletteHex = palette.map(p => p.hex);

        // Render with suggested "on-color" text from the same 1–12 palette
        palette.forEach((bg, index) => {
            const suggestedText = pickDesignerTextColor(bg, palette, index);
            const card = createColorCard(bg.hex, bg.label, suggestedText.hex, index);
            paletteGrid.appendChild(card);
        });
    }

    function hexToRgba(hex, alpha) {
        const rgb = hexToRgb(hex);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }

    function pickForegroundOnLightSurface(primaryHex, fallbackHex) {
        const white = { r: 255, g: 255, b: 255 };
        const primaryRgb = hexToRgb(primaryHex);
        const ratio = contrastRatio(primaryRgb, white);
        return ratio >= 3 ? primaryHex : fallbackHex;
    }

    function createColorCard(bgHex, label, textHex, index) {
        const card = document.createElement('div');
        card.className = 'color-card';
        card.style.animationDelay = `${index * 0.05}s`;

        const softBg = hexToRgba(bgHex, 0.18);
        const softBorder = hexToRgba(bgHex, 0.32);
        const uiFg = pickForegroundOnLightSurface(bgHex, textHex);

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
                        class="example-btn example-btn-solid"
                        type="button"
                        style="background-color: ${bgHex}; color: ${textHex}; border-color: ${textHex};"
                        aria-label="Solid button example"
                    >
                        Solid
                    </button>
                    <button
                        class="example-btn example-btn-outline"
                        type="button"
                        style="background-color: transparent; color: ${uiFg}; border-color: ${uiFg};"
                        aria-label="Outline button example"
                    >
                        Outline
                    </button>
                    <button
                        class="example-btn example-btn-ghost"
                        type="button"
                        style="background-color: transparent; color: ${uiFg}; border-color: transparent;"
                        aria-label="Ghost button example"
                    >
                        Ghost
                    </button>
                    <button
                        class="example-btn example-btn-soft"
                        type="button"
                        style="background-color: ${softBg}; color: ${uiFg}; border-color: ${softBorder};"
                        aria-label="Soft button example"
                    >
                        Soft
                    </button>
                </div>
            </div>
        `;

        card.addEventListener('mouseenter', () => updateHoverPreviewFromHex(bgHex));
        card.addEventListener('mouseleave', () => clearHoverPreview());
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

    function linearToSrgb01(c) {
        return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    }

    function clamp01(c) {
        return Math.max(0, Math.min(1, c));
    }

    function inGamut01(rgb01) {
        return rgb01.r >= 0 && rgb01.r <= 1 && rgb01.g >= 0 && rgb01.g <= 1 && rgb01.b >= 0 && rgb01.b <= 1;
    }

    // OKLab / OKLCH conversion (Björn Ottosson)
    function rgbToOklab(r8, g8, b8) {
        const r = srgbToLinear(r8);
        const g = srgbToLinear(g8);
        const b = srgbToLinear(b8);

        const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
        const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
        const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

        const l_ = Math.cbrt(l);
        const m_ = Math.cbrt(m);
        const s_ = Math.cbrt(s);

        return {
            L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
        };
    }

    function oklabToRgb01(L, a, b) {
        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

        const l = l_ * l_ * l_;
        const m = m_ * m_ * m_;
        const s = s_ * s_ * s_;

        const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        const bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

        return { r, g, b: bb };
    }

    function rgb01ToRgb8(rgb01) {
        const r = Math.round(clamp01(linearToSrgb01(rgb01.r)) * 255);
        const g = Math.round(clamp01(linearToSrgb01(rgb01.g)) * 255);
        const b = Math.round(clamp01(linearToSrgb01(rgb01.b)) * 255);
        return { r, g, b };
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
        const lab = rgbToOklab(r, g, b);
        const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
        const h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
        return { l: lab.L, c, h: (h + 360) % 360 };
    }

    function oklchToRgb(l, c, h) {
        const hr = (h * Math.PI) / 180;
        const a = c * Math.cos(hr);
        const b = c * Math.sin(hr);

        // Simple gamut mapping: reduce chroma until it fits in sRGB.
        let cc = c;
        for (let i = 0; i < 24; i++) {
            const rgbLin = oklabToRgb01(l, a * (cc / c || 0), b * (cc / c || 0));
            if (inGamut01(rgbLin)) {
                return rgb01ToRgb8(rgbLin);
            }
            cc *= 0.90;
        }

        // Fallback: clamp (rare)
        const rgbLin = oklabToRgb01(l, a * 0, b * 0);
        return rgb01ToRgb8(rgbLin);
    }

    updateUI();
    clearHoverPreview();
});
