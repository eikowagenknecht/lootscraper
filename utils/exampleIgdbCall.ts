import { config } from "@/services/config";
import { IgdbClient } from "@/services/gameinfo/igdb/igdb";

const testIgdbCall = async () => {
  // Load the configuration
  config.loadConfig();
  const testConfig = config.get();

  const client = new IgdbClient(
    testConfig.igdb.clientId,
    testConfig.igdb.clientSecret,
  );

  try {
    const res = await client.getDetails(7360);
    console.log(res);
  } catch (error) {
    console.error(error);
  }
};
void testIgdbCall();
