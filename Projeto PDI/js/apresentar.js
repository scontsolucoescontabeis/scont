// Projeto PDI/js/apresentar.js — modo Apresentar: tela cheia, uma seção por tela, sem edição
window.PdiApresentar = (function () {
    'use strict';
    const U = window.PdiUI, Doc = window.PdiDocumento;

    function abrir(d) {
        const slides = window.PdiRender.slides(Doc.montar(d));
        let i = 0;
        const ov = document.createElement('div');
        ov.className = 'apresentacao';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-label', 'Apresentação do PDI');
        ov.innerHTML = `<header><img src="assets/logo-scont.png" alt="SCONT"><span class="ap-pos"></span>
            <button class="btn sec peq" data-x="sair">Sair (Esc)</button></header>
          <main class="ap-corpo documento" tabindex="0"></main>
          <footer><button class="btn sec" data-x="ant">← Anterior</button><button class="btn" data-x="prox">Próximo →</button></footer>`;
        document.body.appendChild(ov);
        document.body.classList.add('em-apresentacao');
        if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {});

        const corpo = ov.querySelector('.ap-corpo');
        function desenhar() {
            corpo.innerHTML = window.PdiRender.blocos(slides[i]);
            corpo.scrollTop = 0;
            ov.querySelector('.ap-pos').textContent = `${i + 1} / ${slides.length}`;
            ov.querySelector('[data-x="ant"]').disabled = i === 0;
            ov.querySelector('[data-x="prox"]').disabled = i === slides.length - 1;
        }
        function sair() {
            document.removeEventListener('keydown', tecla);
            document.body.classList.remove('em-apresentacao');
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            ov.remove();
        }
        function tecla(ev) {
            if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') { ev.preventDefault(); if (i < slides.length - 1) { i++; desenhar(); } }
            else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); if (i > 0) { i--; desenhar(); } }
            else if (ev.key === 'Escape') sair();
        }
        document.addEventListener('keydown', tecla);
        ov.querySelector('[data-x="ant"]').onclick = () => { if (i > 0) { i--; desenhar(); } };
        ov.querySelector('[data-x="prox"]').onclick = () => { if (i < slides.length - 1) { i++; desenhar(); } };
        ov.querySelector('[data-x="sair"]').onclick = sair;
        desenhar();
        if (U) corpo.focus();
    }

    return { abrir };
})();
