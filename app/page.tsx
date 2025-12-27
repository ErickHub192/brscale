import Link from 'next/link';

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-gray-50 to-white">
            <div className="text-center max-w-4xl">
                <h1 className="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                    BR SCALE
                </h1>
                <p className="text-2xl text-gray-700 mb-2">AI-Powered Real Estate Automation</p>
                <p className="text-lg text-gray-500 mb-12">
                    Automate your property listings from draft to close with 6 AI agents
                </p>

                <div className="grid md:grid-cols-2 gap-6 mb-12">
                    <Link
                        href="/dashboard"
                        className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition border border-gray-100"
                    >
                        <div className="text-5xl mb-4">🏠</div>
                        <h2 className="text-2xl font-bold mb-2 text-gray-900">Dashboard</h2>
                        <p className="text-gray-600">View and manage all your properties</p>
                    </Link>

                    <Link
                        href="/properties/new"
                        className="p-8 bg-blue-600 rounded-2xl shadow-lg hover:shadow-xl transition text-white"
                    >
                        <div className="text-5xl mb-4">✨</div>
                        <h2 className="text-2xl font-bold mb-2">New Property</h2>
                        <p className="text-blue-100">Create a new listing with AI automation</p>
                    </Link>
                </div>

                <div className="bg-gray-100 rounded-xl p-6 text-left">
                    <h3 className="font-semibold text-lg mb-3 text-gray-900">🤖 AI Agents:</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li>✅ <strong>Input Manager:</strong> Validates property data</li>
                        <li>✅ <strong>Marketing Agent:</strong> Generates descriptions & social posts</li>
                        <li>✅ <strong>Lead Manager:</strong> Qualifies and responds to leads 24/7</li>
                        <li>✅ <strong>Negotiation Agent:</strong> Handles offers & counter-offers</li>
                        <li>✅ <strong>Legal Agent:</strong> Generates contracts & disclosures</li>
                        <li>✅ <strong>Closure Agent:</strong> Manages closing process</li>
                    </ul>
                </div>
            </div>
        </main>
    );
}
