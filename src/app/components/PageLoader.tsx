export default function PageLoader() {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-gradient-to-br from-[#F7E2F8]/70 to-[#AEE3E6]/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        {/* Animated logo */}
        <div className="animate-[loaderPulse_1.6s_ease-in-out_infinite]">
          <svg width="219" height="77" viewBox="0 0 219 77" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-48 h-auto">
            <path
              d="M191.419 32.4519C197.375 21.5101 188.444 25.3832 183.234 28.6874C97.2679 83.2079 21.5955 47.9542 7.28707 42.9781C0.305509 40.55 0.30552 40.55 0.30552 40.55C14.7773 57.4099 46.738 74.6491 96.8154 72.5271C151.038 70.2295 183.973 46.1293 191.419 32.4519Z"
              fill="url(#loader_grad)"
            />
            <path
              d="M206.562 24C202.867 24 199.829 22.8817 197.448 20.6452C195.149 18.3226 194 15.4839 194 12.129C194 8.68817 195.149 5.80645 197.448 3.48387C199.829 1.16129 202.867 0 206.562 0C210.174 0 213.13 1.16129 215.429 3.48387C217.81 5.80645 219 8.68817 219 12.129C219 15.4839 217.81 18.3226 215.429 20.6452C213.13 22.8817 210.174 24 206.562 24Z"
              fill="#1a1a1a"
            />
            <defs>
              <linearGradient id="loader_grad" x1="194.233" y1="46.7544" x2="0.915519" y2="54.9459" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4D8EF7" />
                <stop offset="1" stopColor="#A59DFF" />
              </linearGradient>
            </defs>
          </svg>
        </div>

      </div>

      <style>{`
        @keyframes loaderPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.96); }
        }
      `}</style>
    </div>
  );
}
