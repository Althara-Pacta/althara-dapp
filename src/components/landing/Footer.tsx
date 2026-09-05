import Image from "next/image";


export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 flex items-center justify-center">
                <Image src="/althara pacta logo.png" alt="Althara Pacta" width={32} height={32} />
              </div>
              <span className="text-xl font-bold">Althara Pacta</span>
            </div>
            <p className="text-gray-400">
              Decentralized and transparent government tendering platform.
            </p>
          </div>
        
          <div>
            <h3 className="font-semibold mb-4">Technology</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="https://filecoin.io/" className="hover:text-white transition-colors">Filecoin</a></li>
              <li><a href="https://ethereum.org/" className="hover:text-white transition-colors">Ethereum</a></li>
              <li><a href="https://soliditylang.org/" className="hover:text-white transition-colors">Smart Contracts (Solidity)</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 py-8 text-center text-gray-400">
          <p>&copy; 2025 Althara Pacta. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
