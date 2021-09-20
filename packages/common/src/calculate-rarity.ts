import { INftMetadata, INftRarity } from "./types";
import { promises as fs } from 'fs';

/**
 * # Markdown!
 * 
 * https://www.youtube.com/watch?v=O9TNz1-dI-Q
 */


/**
  ```c#
 var items = await RarityItemCollection.LoadAsync(Path);
 var attributes = items.SelectMany(x => x.Attributes);

 return (from attribute in attributes
    where attribute.Value.Length > 0 // clean out empty values                
    group attribute by attribute.TraitType into g1
    let distinctValues = g1.Select(x => x.Value).Distinct()
    let attributeTraitsTotalCount = attributes.Where(x => x.Value.Length > 0).Select(x => x.Value).Distinct().Count()
    select new ItemAttribute {
        AttributeName = g1.Key,
        AttributeTotalTraits = distinctValues.Count(),
        TraitsCount = attributeTraitsTotalCount,
        Traits = distinctValues.Select(x => new ItemTrait {
            TraitName = x,
            AttributeTraitCount = g1.Count(y => y.Value == x),
            AttributeTraitTotalCount = g1.Count(),
        }).ToList(),
        AttributeTraitTotalCount = g1.Count(),
        AllTraitsCount = attributes.Where(x => x.Value.Length > 0).Count(),
    }).ToList();
 ```
 */
export function calculateRarity(metadataRaw: INftMetadata[], options?: { includeTraitCount?: boolean }): INftRarity[] {
    const { includeTraitCount = true } = options ?? {};

    const metadata = metadataRaw.map(x => ({
        ...x,
        attributes: [
            ...x.attributes, 
            ...includeTraitCount ? [{ trait_type: 'Trait Count', value: `${x.attributes.length}` }] : [] 
        ],
    }));

    const allAttributesRaw = metadata.flatMap(x => x.attributes).filter(x => !!x.value);

    // type NftAttribute = INftMetadata['attributes'][number];
    const allAttributesValuesMapRaw = new Map(allAttributesRaw.map(x=> [x.trait_type, [] as string[]]));
    // console.log('calcRarity', {allAttributesMap});

    metadata.forEach(x => {

        const traitTypes = [...allAttributesValuesMapRaw.keys()];
        const missingTraits = traitTypes
            .filter(a => !x.attributes.some(a2 => a2.trait_type === a))
            .map(a => ({ trait_type: a, value: '[Missing]' }))
            ;

        x.attributes = [
            ...x.attributes,
            ...missingTraits,
        ];
    });

    const allAttributes = metadata.flatMap(x => x.attributes).filter(x => !!x.value);
    const allAttributesValuesMap = new Map(allAttributes.map(x=> [x.trait_type, [] as string[]]));

    allAttributes.forEach(x => {
        const values = allAttributesValuesMap.get(x.trait_type);
        if( !values ){ throw new Error('Missing trait_type'); }
        values.push(x.value);
    });
    // console.log('calcRarity', {allAttributesValuesMap});
    
    const allAttributesValuesDistinct = new Map([...allAttributesValuesMap.entries()].map(([key,value])=>[key, [...new Set(value)]]));
    // console.log('calcRarity', allAttributesValuesDistinct);

    const attributeRarities = [...allAttributesValuesMap.keys()].map(x => {

        const traitType = x;
        const traitDistinctValues = allAttributesValuesDistinct.get(x) ?? [];
        const traitValues = allAttributesValuesMap.get(x) ?? [];

        const valuesCount = traitValues.length;
        const distinctCount = traitDistinctValues.length;
        const valueRarities = traitDistinctValues.map(v => {
            // i.e. Smile (value of Emotion)
            const valueName = v;
            const count = traitValues.filter(t => t === v).length;
            const ratioIfDefined = count / valuesCount;
            const ratio = count / metadata.length;
            const ratioScore = 1 / ratio;
            return {
                valueName,
                count,
                ratio,
                ratioIfDefined,
                ratioScore,
            }
        });

        return {
            traitType,
            valuesCount,
            distinctCount,
            valueRarities,
        };

        
        // ({
        // // AttributeName = g1.Key,
        // // AttributeTotalTraits = distinctValues.Count(),
        // // TraitsCount = attributeTraitsTotalCount,
        // // Traits = distinctValues.Select(x => new ItemTrait {
        // //     TraitName = x,
        // //     AttributeTraitCount = g1.Count(y => y.Value == x),
        // //     AttributeTraitTotalCount = g1.Count(),
        // // }).ToList(),
        // // AttributeTraitTotalCount = g1.Count(),
        // // AllTraitsCount = attributes.Where(x => x.Value.Length > 0).Count(),
    });

    // console.log('calcRarity', { 
    //     emotion: attributeRarities.find(x=>x.traitType === 'Emotion'),
    //     emotionValues: attributeRarities.find(x=>x.traitType === 'Emotion')?.valueRarities
    // });

    const nftRaritiesRaw = metadata.map(x => ({
        nft: x,
        attributeRarities: x.attributes.map(a => { 
            const traitRarity = attributeRarities.find(r => r.traitType === a.trait_type);
            const valueRarity = traitRarity?.valueRarities.find(v=>v.valueName === a.value);
            if(!valueRarity){
                return null;
            }

            return {
                ...a,
                ...valueRarity,
            };
        }).filter(x=>x).map(x=>x!)
        
        // attributeRarities.filter(a => a.traitType ===  )
    })).map(x => ({
        ...x,
        rarityScore: x.attributeRarities.reduce((out,a) => { out += a.ratioScore ?? 0; return out; }, 0),
    }));

    const nftRarities: INftRarity[] = nftRaritiesRaw
        .sort((a,b) => (-(a.rarityScore-b.rarityScore)))
        .map((x,i)=>({
            ...x,
            rank: i 
        }));

    // console.log('calcRarity', { 
    //     nft: nftRarities[0].nft.id, 
    //     rarityScore: nftRarities[0].rarityScore,
    //     rarities: nftRarities[0].attributeRarities,
    // });

    return nftRarities;
} 