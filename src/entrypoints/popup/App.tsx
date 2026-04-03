import { Button } from "@/components/ui/button";
import { sendMessage } from "@/lib/messaging";
import {useTheme} from "@/lib/useTheme.ts";

function App() {
    const [theme, setTheme] = useTheme();

    const openDashboard = async () => {
        const url = await sendMessage("getExtensionPageUrl", "/dashboard.html");

        console.log("Opening dashboard at:", url);

        window.open(url);
    }

    return (
        <div className="m-10">
            <Button onClick={openDashboard}>Open Dashboard</Button>
        </div>
    );
}

export default App;