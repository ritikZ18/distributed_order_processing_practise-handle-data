import React from 'react';

type ErrorBoundaryProps = {
    children: React.ReactNode;
};

type ErrorBoundaryState = {
    hasError: boolean;
    errorMessage?: string;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { hasError: true, errorMessage };
    }

    componentDidCatch(error: unknown, info: unknown) {
        // Keep this console output for debugging in the browser.
        console.error('UI crashed:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full preloader-bg p-6">
                    <div className="glass-card p-6">
                        <div className="text-lg font-semibold text-white mb-2">UI Error</div>
                        <div className="text-sm text-slate-400 mb-4">
                            The dashboard hit a runtime error. Open DevTools Console for details.
                        </div>
                        <div className="font-mono text-sm text-rose-300 whitespace-pre-wrap">
                            {this.state.errorMessage ?? 'Unknown error'}
                        </div>
                        <div className="text-xs text-slate-500 mt-4">
                            Tip: hard refresh the page after restarting services.
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
