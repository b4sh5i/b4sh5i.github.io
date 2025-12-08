/**
 * 토스트 메시지 시스템
 * alert 대신 사용하여 브라우저 자동화 차단 방지
 */

/**
 * 토스트 메시지 표시
 * @param {string} message - 표시할 메시지
 * @param {number} duration - 표시 시간 (밀리초)
 * @param {string} type - 메시지 타입 ('success', 'error', 'info')
 */
function showToast(message, duration = 3000, type = 'info') {
    // 기존 토스트 컨테이너 찾기 또는 생성
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // 토스트 요소 생성
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // 아이콘 추가
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = getToastIcon(type);

    // 메시지 추가
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    // 애니메이션 시작
    setTimeout(() => toast.classList.add('show'), 10);

    // 자동 제거
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            container.removeChild(toast);
            // 컨테이너가 비어있으면 제거
            if (container.children.length === 0) {
                document.body.removeChild(container);
            }
        }, 300);
    }, duration);
}

/**
 * 타입에 따른 아이콘 반환
 */
function getToastIcon(type) {
    switch (type) {
        case 'success':
            return '✅';
        case 'error':
            return '❌';
        case 'info':
        default:
            return 'ℹ️';
    }
}

/**
 * 성공 메시지
 */
function showSuccess(message, duration = 3000) {
    showToast(message, duration, 'success');
}

/**
 * 에러 메시지
 */
function showError(message, duration = 3000) {
    showToast(message, duration, 'error');
}

/**
 * 정보 메시지
 */
function showInfo(message, duration = 3000) {
    showToast(message, duration, 'info');
}
