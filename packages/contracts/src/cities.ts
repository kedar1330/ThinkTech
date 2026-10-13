import { z } from 'zod';

// Indian cities for the searchable city field (D-87). Every state and union-territory capital plus major
// cities. IDs are stable slugs; add cities freely (no migration needed), never rename or remove an ID.

type CityRow = readonly [id: string, name: string, state: string];

const ROWS = [
  // Andhra Pradesh
  ['amaravati', 'Amaravati', 'Andhra Pradesh'],
  ['visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh'],
  ['vijayawada', 'Vijayawada', 'Andhra Pradesh'],
  ['guntur', 'Guntur', 'Andhra Pradesh'],
  ['nellore', 'Nellore', 'Andhra Pradesh'],
  ['kurnool', 'Kurnool', 'Andhra Pradesh'],
  ['tirupati', 'Tirupati', 'Andhra Pradesh'],
  ['rajahmundry', 'Rajahmundry', 'Andhra Pradesh'],
  ['kakinada', 'Kakinada', 'Andhra Pradesh'],
  // Arunachal Pradesh
  ['itanagar', 'Itanagar', 'Arunachal Pradesh'],
  // Assam
  ['guwahati', 'Guwahati', 'Assam'],
  ['dispur', 'Dispur', 'Assam'],
  ['dibrugarh', 'Dibrugarh', 'Assam'],
  ['silchar', 'Silchar', 'Assam'],
  ['jorhat', 'Jorhat', 'Assam'],
  // Bihar
  ['patna', 'Patna', 'Bihar'],
  ['gaya', 'Gaya', 'Bihar'],
  ['bhagalpur', 'Bhagalpur', 'Bihar'],
  ['muzaffarpur', 'Muzaffarpur', 'Bihar'],
  ['darbhanga', 'Darbhanga', 'Bihar'],
  // Chhattisgarh
  ['raipur', 'Raipur', 'Chhattisgarh'],
  ['bhilai', 'Bhilai', 'Chhattisgarh'],
  ['bilaspur-chhattisgarh', 'Bilaspur', 'Chhattisgarh'],
  ['korba', 'Korba', 'Chhattisgarh'],
  // Goa
  ['panaji', 'Panaji', 'Goa'],
  ['margao', 'Margao', 'Goa'],
  ['vasco-da-gama', 'Vasco da Gama', 'Goa'],
  // Gujarat
  ['ahmedabad', 'Ahmedabad', 'Gujarat'],
  ['gandhinagar', 'Gandhinagar', 'Gujarat'],
  ['surat', 'Surat', 'Gujarat'],
  ['vadodara', 'Vadodara', 'Gujarat'],
  ['rajkot', 'Rajkot', 'Gujarat'],
  ['bhavnagar', 'Bhavnagar', 'Gujarat'],
  ['jamnagar', 'Jamnagar', 'Gujarat'],
  ['junagadh', 'Junagadh', 'Gujarat'],
  ['anand', 'Anand', 'Gujarat'],
  // Haryana
  ['gurugram', 'Gurugram', 'Haryana'],
  ['faridabad', 'Faridabad', 'Haryana'],
  ['panipat', 'Panipat', 'Haryana'],
  ['ambala', 'Ambala', 'Haryana'],
  ['karnal', 'Karnal', 'Haryana'],
  ['hisar', 'Hisar', 'Haryana'],
  ['rohtak', 'Rohtak', 'Haryana'],
  ['sonipat', 'Sonipat', 'Haryana'],
  // Himachal Pradesh
  ['shimla', 'Shimla', 'Himachal Pradesh'],
  ['dharamshala', 'Dharamshala', 'Himachal Pradesh'],
  ['manali', 'Manali', 'Himachal Pradesh'],
  ['mandi', 'Mandi', 'Himachal Pradesh'],
  ['solan', 'Solan', 'Himachal Pradesh'],
  // Jharkhand
  ['ranchi', 'Ranchi', 'Jharkhand'],
  ['jamshedpur', 'Jamshedpur', 'Jharkhand'],
  ['dhanbad', 'Dhanbad', 'Jharkhand'],
  ['bokaro', 'Bokaro Steel City', 'Jharkhand'],
  ['hazaribagh', 'Hazaribagh', 'Jharkhand'],
  // Karnataka
  ['bengaluru', 'Bengaluru', 'Karnataka'],
  ['mysuru', 'Mysuru', 'Karnataka'],
  ['mangaluru', 'Mangaluru', 'Karnataka'],
  ['hubballi', 'Hubballi', 'Karnataka'],
  ['dharwad', 'Dharwad', 'Karnataka'],
  ['belagavi', 'Belagavi', 'Karnataka'],
  ['kalaburagi', 'Kalaburagi', 'Karnataka'],
  ['davanagere', 'Davanagere', 'Karnataka'],
  ['ballari', 'Ballari', 'Karnataka'],
  ['udupi', 'Udupi', 'Karnataka'],
  ['shivamogga', 'Shivamogga', 'Karnataka'],
  ['tumakuru', 'Tumakuru', 'Karnataka'],
  // Kerala
  ['thiruvananthapuram', 'Thiruvananthapuram', 'Kerala'],
  ['kochi', 'Kochi', 'Kerala'],
  ['kozhikode', 'Kozhikode', 'Kerala'],
  ['thrissur', 'Thrissur', 'Kerala'],
  ['kollam', 'Kollam', 'Kerala'],
  ['kannur', 'Kannur', 'Kerala'],
  ['kottayam', 'Kottayam', 'Kerala'],
  ['palakkad', 'Palakkad', 'Kerala'],
  ['alappuzha', 'Alappuzha', 'Kerala'],
  // Madhya Pradesh
  ['bhopal', 'Bhopal', 'Madhya Pradesh'],
  ['indore', 'Indore', 'Madhya Pradesh'],
  ['jabalpur', 'Jabalpur', 'Madhya Pradesh'],
  ['gwalior', 'Gwalior', 'Madhya Pradesh'],
  ['ujjain', 'Ujjain', 'Madhya Pradesh'],
  ['sagar', 'Sagar', 'Madhya Pradesh'],
  ['rewa', 'Rewa', 'Madhya Pradesh'],
  ['satna', 'Satna', 'Madhya Pradesh'],
  // Maharashtra
  ['mumbai', 'Mumbai', 'Maharashtra'],
  ['pune', 'Pune', 'Maharashtra'],
  ['nagpur', 'Nagpur', 'Maharashtra'],
  ['thane', 'Thane', 'Maharashtra'],
  ['navi-mumbai', 'Navi Mumbai', 'Maharashtra'],
  ['nashik', 'Nashik', 'Maharashtra'],
  ['aurangabad', 'Chhatrapati Sambhajinagar (Aurangabad)', 'Maharashtra'],
  ['solapur', 'Solapur', 'Maharashtra'],
  ['kolhapur', 'Kolhapur', 'Maharashtra'],
  ['amravati', 'Amravati', 'Maharashtra'],
  ['nanded', 'Nanded', 'Maharashtra'],
  ['sangli', 'Sangli', 'Maharashtra'],
  ['jalgaon', 'Jalgaon', 'Maharashtra'],
  ['akola', 'Akola', 'Maharashtra'],
  ['latur', 'Latur', 'Maharashtra'],
  ['ahilyanagar', 'Ahilyanagar (Ahmednagar)', 'Maharashtra'],
  ['vasai-virar', 'Vasai-Virar', 'Maharashtra'],
  ['kalyan-dombivli', 'Kalyan-Dombivli', 'Maharashtra'],
  ['pimpri-chinchwad', 'Pimpri-Chinchwad', 'Maharashtra'],
  // Manipur
  ['imphal', 'Imphal', 'Manipur'],
  // Meghalaya
  ['shillong', 'Shillong', 'Meghalaya'],
  // Mizoram
  ['aizawl', 'Aizawl', 'Mizoram'],
  // Nagaland
  ['kohima', 'Kohima', 'Nagaland'],
  ['dimapur', 'Dimapur', 'Nagaland'],
  // Odisha
  ['bhubaneswar', 'Bhubaneswar', 'Odisha'],
  ['cuttack', 'Cuttack', 'Odisha'],
  ['rourkela', 'Rourkela', 'Odisha'],
  ['berhampur', 'Berhampur', 'Odisha'],
  ['sambalpur', 'Sambalpur', 'Odisha'],
  ['puri', 'Puri', 'Odisha'],
  // Punjab
  ['ludhiana', 'Ludhiana', 'Punjab'],
  ['amritsar', 'Amritsar', 'Punjab'],
  ['jalandhar', 'Jalandhar', 'Punjab'],
  ['patiala', 'Patiala', 'Punjab'],
  ['bathinda', 'Bathinda', 'Punjab'],
  ['mohali', 'Mohali (SAS Nagar)', 'Punjab'],
  // Rajasthan
  ['jaipur', 'Jaipur', 'Rajasthan'],
  ['jodhpur', 'Jodhpur', 'Rajasthan'],
  ['udaipur', 'Udaipur', 'Rajasthan'],
  ['kota', 'Kota', 'Rajasthan'],
  ['ajmer', 'Ajmer', 'Rajasthan'],
  ['bikaner', 'Bikaner', 'Rajasthan'],
  ['alwar', 'Alwar', 'Rajasthan'],
  ['bhilwara', 'Bhilwara', 'Rajasthan'],
  ['sikar', 'Sikar', 'Rajasthan'],
  // Sikkim
  ['gangtok', 'Gangtok', 'Sikkim'],
  // Tamil Nadu
  ['chennai', 'Chennai', 'Tamil Nadu'],
  ['coimbatore', 'Coimbatore', 'Tamil Nadu'],
  ['madurai', 'Madurai', 'Tamil Nadu'],
  ['tiruchirappalli', 'Tiruchirappalli', 'Tamil Nadu'],
  ['salem', 'Salem', 'Tamil Nadu'],
  ['tirunelveli', 'Tirunelveli', 'Tamil Nadu'],
  ['tiruppur', 'Tiruppur', 'Tamil Nadu'],
  ['erode', 'Erode', 'Tamil Nadu'],
  ['vellore', 'Vellore', 'Tamil Nadu'],
  ['thoothukudi', 'Thoothukudi', 'Tamil Nadu'],
  ['thanjavur', 'Thanjavur', 'Tamil Nadu'],
  ['hosur', 'Hosur', 'Tamil Nadu'],
  // Telangana
  ['hyderabad', 'Hyderabad', 'Telangana'],
  ['warangal', 'Warangal', 'Telangana'],
  ['nizamabad', 'Nizamabad', 'Telangana'],
  ['karimnagar', 'Karimnagar', 'Telangana'],
  ['khammam', 'Khammam', 'Telangana'],
  // Tripura
  ['agartala', 'Agartala', 'Tripura'],
  // Uttar Pradesh
  ['lucknow', 'Lucknow', 'Uttar Pradesh'],
  ['kanpur', 'Kanpur', 'Uttar Pradesh'],
  ['noida', 'Noida', 'Uttar Pradesh'],
  ['ghaziabad', 'Ghaziabad', 'Uttar Pradesh'],
  ['greater-noida', 'Greater Noida', 'Uttar Pradesh'],
  ['agra', 'Agra', 'Uttar Pradesh'],
  ['varanasi', 'Varanasi', 'Uttar Pradesh'],
  ['prayagraj', 'Prayagraj', 'Uttar Pradesh'],
  ['meerut', 'Meerut', 'Uttar Pradesh'],
  ['bareilly', 'Bareilly', 'Uttar Pradesh'],
  ['aligarh', 'Aligarh', 'Uttar Pradesh'],
  ['moradabad', 'Moradabad', 'Uttar Pradesh'],
  ['gorakhpur', 'Gorakhpur', 'Uttar Pradesh'],
  ['jhansi', 'Jhansi', 'Uttar Pradesh'],
  ['mathura', 'Mathura', 'Uttar Pradesh'],
  ['ayodhya', 'Ayodhya', 'Uttar Pradesh'],
  ['saharanpur', 'Saharanpur', 'Uttar Pradesh'],
  // Uttarakhand
  ['dehradun', 'Dehradun', 'Uttarakhand'],
  ['haridwar', 'Haridwar', 'Uttarakhand'],
  ['rishikesh', 'Rishikesh', 'Uttarakhand'],
  ['haldwani', 'Haldwani', 'Uttarakhand'],
  ['roorkee', 'Roorkee', 'Uttarakhand'],
  // West Bengal
  ['kolkata', 'Kolkata', 'West Bengal'],
  ['howrah', 'Howrah', 'West Bengal'],
  ['durgapur', 'Durgapur', 'West Bengal'],
  ['asansol', 'Asansol', 'West Bengal'],
  ['siliguri', 'Siliguri', 'West Bengal'],
  ['darjeeling', 'Darjeeling', 'West Bengal'],
  ['kharagpur', 'Kharagpur', 'West Bengal'],
  // Union territories
  ['port-blair', 'Sri Vijaya Puram (Port Blair)', 'Andaman and Nicobar Islands'],
  ['chandigarh', 'Chandigarh', 'Chandigarh'],
  ['daman', 'Daman', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['silvassa', 'Silvassa', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['new-delhi', 'New Delhi', 'Delhi'],
  ['delhi', 'Delhi', 'Delhi'],
  ['srinagar', 'Srinagar', 'Jammu and Kashmir'],
  ['jammu', 'Jammu', 'Jammu and Kashmir'],
  ['leh', 'Leh', 'Ladakh'],
  ['kavaratti', 'Kavaratti', 'Lakshadweep'],
  ['puducherry', 'Puducherry', 'Puducherry'],
] as const satisfies readonly CityRow[];

export const INDIAN_CITIES = ROWS.map(([id, name, state]) => ({ id, name, state }));
export type CityId = (typeof ROWS)[number][0];
export const CITY_IDS = ROWS.map(([id]) => id) as [CityId, ...CityId[]];
export const cityIdSchema = z.enum(CITY_IDS, { message: 'Choose your city from the list' });

const BY_ID = new Map(INDIAN_CITIES.map((c) => [c.id, c]));
export function cityLabel(id: string | null | undefined): string | null {
  const city = id ? BY_ID.get(id as CityId) : undefined;
  return city ? `${city.name}, ${city.state}` : null;
}

/** Case- and accent-insensitive prefix/word match on city and state names. */
export function searchCities(query: string, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return INDIAN_CITIES.slice(0, limit);
  const scored = INDIAN_CITIES.map((c) => {
    const name = c.name.toLowerCase();
    const words = `${name} ${c.state.toLowerCase()}`.split(/[\s(),-]+/);
    const score = name.startsWith(q) ? 0 : words.some((w) => w.startsWith(q)) ? 1 : name.includes(q) ? 2 : 3;
    return { c, score };
  }).filter((x) => x.score < 3);
  scored.sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((x) => x.c);
}
