import { registerRootComponent } from 'expo';
import App from './App';

// SAFE START: pentru APK-ul instalat direct pornim aplicația principală fără
// autentificarea Supabase la bootstrap. Contul va fi reactivat după ce
// stabilitatea de pornire este confirmată pe dispozitiv.
registerRootComponent(App);
