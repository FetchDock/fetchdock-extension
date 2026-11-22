import { Button } from "@/components/ui/button";
import { sendMessage } from "@/lib/messaging";
import {useTheme} from "@/lib/useTheme.ts";
import { SitePanel } from "./SitePanel";
import { ReportPageButton } from "./ReportPageButton";

function App() {
    const [theme, setTheme] = useTheme();

    const openDashboard = async () => {
        const url = await sendMessage("getExtensionPageUrl", "/dashboard.html");

        window.open(url);
    }

    return (
        <div className="m-4 w-80 space-y-4">
            <SitePanel />
            <div className="flex flex-wrap items-center gap-2">
                <Button onClick={openDashboard}>Open Dashboard</Button>
                <ReportPageButton />
            </div>
        </div>
    );
}

export default App;
