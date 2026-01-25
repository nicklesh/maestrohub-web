import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UserAvatarProps {
  name: string;
  role?: 'tutor' | 'consumer' | 'admin';
  category?: string;
  size?: number;
  backgroundColor?: string;
}

// Category to icon and color mapping
const CATEGORY_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  academics: { icon: 'book', color: '#3B82F6' },         // Blue - book
  wellness: { icon: 'heart', color: '#10B981' },          // Green - heart
  sports: { icon: 'football', color: '#F59E0B' },         // Orange - football
  fitness: { icon: 'fitness', color: '#EF4444' },         // Red - fitness
  music: { icon: 'musical-notes', color: '#8B5CF6' },     // Purple - music
  arts: { icon: 'color-palette', color: '#EC4899' },      // Pink - palette
  languages: { icon: 'language', color: '#06B6D4' },      // Cyan - language
  technology: { icon: 'laptop', color: '#6366F1' },       // Indigo - laptop
  business: { icon: 'briefcase', color: '#64748B' },      // Slate - briefcase
  cooking: { icon: 'restaurant', color: '#F97316' },      // Orange - restaurant
  dance: { icon: 'body', color: '#D946EF' },              // Fuchsia - body
  yoga: { icon: 'leaf', color: '#22C55E' },               // Green - leaf
  martial_arts: { icon: 'hand-left', color: '#DC2626' },  // Red - hand
  photography: { icon: 'camera', color: '#0EA5E9' },      // Sky - camera
  writing: { icon: 'pencil', color: '#A855F7' },          // Purple - pencil
  default: { icon: 'school', color: '#3B82F6' },          // Blue - school
};

// Get config for a category (handles partial matches)
const getCategoryConfig = (category?: string) => {
  if (!category) return CATEGORY_CONFIG.default;
  
  const lowerCategory = category.toLowerCase();
  
  // Check for exact match first
  if (CATEGORY_CONFIG[lowerCategory]) {
    return CATEGORY_CONFIG[lowerCategory];
  }
  
  // Check for partial matches
  for (const [key, config] of Object.entries(CATEGORY_CONFIG)) {
    if (lowerCategory.includes(key) || key.includes(lowerCategory)) {
      return config;
    }
  }
  
  return CATEGORY_CONFIG.default;
};

export function UserAvatar({ 
  name, 
  role = 'consumer', 
  category, 
  size = 48,
  backgroundColor 
}: UserAvatarProps) {
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const iconSize = size * 0.35;
  const initialSize = size * 0.45;
  
  // For coaches, use category-based styling
  if (role === 'tutor') {
    const config = getCategoryConfig(category);
    const bgColor = backgroundColor || config.color + '20';
    
    return (
      <View style={[
        styles.container, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: bgColor,
          borderWidth: 2,
          borderColor: config.color + '40',
        }
      ]}>
        {/* Category Icon */}
        <View style={[styles.iconBadge, { backgroundColor: config.color }]}>
          <Ionicons 
            name={config.icon} 
            size={iconSize * 0.7} 
            color="#FFFFFF" 
          />
        </View>
        {/* Initial */}
        <Text style={[styles.initial, { fontSize: initialSize, color: config.color }]}>
          {initial}
        </Text>
      </View>
    );
  }
  
  // For consumers (parents), use a simple avatar with user icon
  const consumerColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
  const colorIndex = name ? name.charCodeAt(0) % consumerColors.length : 0;
  const color = consumerColors[colorIndex];
  
  return (
    <View style={[
      styles.container, 
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        backgroundColor: color + '20',
        borderWidth: 2,
        borderColor: color + '40',
      }
    ]}>
      {/* User Icon Badge */}
      <View style={[styles.iconBadge, { backgroundColor: color }]}>
        <Ionicons 
          name="person" 
          size={iconSize * 0.7} 
          color="#FFFFFF" 
        />
      </View>
      {/* Initial */}
      <Text style={[styles.initial, { fontSize: initialSize, color: color }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  initial: {
    fontWeight: '700',
  },
  iconBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export default UserAvatar;
