import { useState } from "react";
import { Button } from "@/components/ui/button";

function App() {
    const [count, setCount] = useState(0);

    const openDashboard = () => {
        const url = browser.runtime.getURL('/dashboard.html');

        console.log("Opening dashboard at:", url);

        window.open(url);
    }

    return (
        <div className="m-10">
            <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>
            <Button onClick={openDashboard}>Open Dashboard</Button>
        </div>
    );
}

export default App;